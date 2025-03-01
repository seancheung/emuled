import { randomUUID } from "crypto";
import { Socket } from "net";
import { EventEmitter } from "stream";
import {
  ClientLoginRequest,
  ClientSearchRequest,
} from "./message/client-to-server";
import { IncomingMessage } from "./message/incoming-message";
import { MessageProtocol } from "./message/message-header";
import {
  SearchResultEntry,
  ServerCommand,
  ServerGeneralMessageBody,
  ServerIDChangeMessageBody,
  ServerSearchResultMessageBody,
  ServerStatusMessageBody,
} from "./message/server-to-client";
import { FileTag } from "./message/tag";

export class Client extends EventEmitter<ClientEvents> {
  private readonly nickName: string;
  private readonly clientPort: number;
  private readonly userHash: string;
  protected readonly socket: Socket;
  private clientId: number = 0;
  private session: Readonly<ClientSession>;
  protected pendingMessage?: IncomingMessage<ServerCommand>;

  constructor(options?: ClientOptions) {
    super();
    const {
      nickName = "https://www.emule-project.org",
      clientPort = 15490,
      uuid = randomUUID(),
    } = options || {};
    this.nickName = nickName;
    this.clientPort = clientPort;
    this.userHash = uuid.replace(/-/g, "");
    this.socket = new Socket();
    this.socket.addListener("error", (err) => this.onError(err));
    this.socket.addListener("close", () => this.onClose());
    this.socket.addListener("data", (data) => this.onReceive(data));
    this.session = {
      state: ClientState.Disconnected,
    };
  }

  protected onConnect() {
    this.session = {
      ...this.session,
      state: ClientState.Connected,
    };
    this.pushLog(
      `[INFO] connected to ${this.session.server?.host || "unknown"}:${
        this.session.server?.port || "0000"
      }`
    );
    this.emit("connected", this.session);
  }

  protected onError(err: Error) {
    this.pushLog(`[ERROR] ${err.message}`);
    this.emit("error", err);
  }

  protected onClose() {
    this.session = {
      state: ClientState.Disconnected,
    };
    this.pushLog("[INFO] disconnected");
    this.emit("disconnected");
  }

  protected onReceive(data: Buffer) {
    const protocol = data.readUInt8();
    this.pushLog(`[VERBORSE] received ${data.length} bytes`);
    switch (protocol) {
      case MessageProtocol.EMule:
      case MessageProtocol.EDonkey:
      case MessageProtocol.Packed:
        {
          const message = new IncomingMessage<ServerCommand>(data);
          if (!message.isComplete) {
            this.pendingMessage = message;
          } else {
            this.dispatchMessage(message).catch((err) => this.onError(err));
          }
        }
        break;
      default:
        {
          if (!this.pendingMessage) {
            this.onError(new Error("unknown message protocol"));
            break;
          }
          this.pendingMessage.write(data);
          if (this.pendingMessage.isComplete) {
            const message = this.pendingMessage;
            this.pendingMessage = undefined;
            this.dispatchMessage(message).catch((err) => this.onError(err));
          }
        }
        break;
    }
  }

  protected async dispatchMessage(message: IncomingMessage<ServerCommand>) {
    const header = message.header;
    const data = await message.getBody();
    switch (header.command) {
      case ServerCommand.ServerMessage:
        {
          const body = new ServerGeneralMessageBody(data);
          this.pushMessage(body.message);
          this.pushLog(`[SERVER] ${body.message}`);
          this.emit("servermessage", this.session);
        }
        break;
      case ServerCommand.IDChange:
        {
          const body = new ServerIDChangeMessageBody(data);
          this.clientId = body.newId;
          this.session = {
            ...this.session,
            state: ClientState.Idle,
            clientId: body.newId,
            flags: body.flags,
          };
          this.pushLog(`[INFO] new client id is ${body.newId}`);
          this.emit("idchange", this.session);
        }
        break;
      case ServerCommand.ServerStatus:
        {
          const body = new ServerStatusMessageBody(data);
          this.session = {
            ...this.session,
            users: body.users,
            files: body.files,
          };
          this.pushLog(
            `[INFO] server has ${body.users} users and ${body.files} files`
          );
          this.emit("serverstatus", this.session);
        }
        break;
      case ServerCommand.SearchResult:
        {
          const body = new ServerSearchResultMessageBody(data);
          const results = {
            ...this.session.results,
            [this.session.lastQuery || "Files"]: body.results.map((e) =>
              this.transformResult(e)
            ),
          };
          this.session = {
            ...this.session,
            state: ClientState.Idle,
            results,
          };
          this.pushLog(`[VERBOSE] found ${body.results.length} search results`);
          this.emit("searchresult", this.session);
        }
        break;
      default:
        return;
    }
  }

  protected pushMessage(message: string) {
    this.session = {
      ...this.session,
      messages: [...(this.session.messages || []), message],
    };
  }

  protected pushLog(log: string) {
    this.session = {
      ...this.session,
      logs: [...(this.session.logs || []), log],
    };
  }

  protected transformResult(res: SearchResultEntry): SearchResult {
    const tags = res.tags.reduce((acc, tag) => {
      acc[tag.name] = tag.value;
      return acc;
    }, {} as Record<string, string | number>);
    return {
      hash: res.hash,
      name: tags[FileTag.FileName] as string,
      size: tags[FileTag.FileSize] as number,
      sources: tags[FileTag.FileSources] as number,
      completeSources: tags[FileTag.FileCompleteSources] as number,
    };
  }

  connect(host: string, port: number) {
    if (this.session.state > ClientState.Disconnected) {
      throw new Error("client is connecting or already connected");
    }
    this.session = {
      state: ClientState.Connecting,
      server: { host, port },
    };
    this.socket.connect(port, host, () => this.onConnect());
    this.pushLog("[VERBOSE] begin connect");
  }

  login() {
    if (this.session.state < ClientState.Connected) {
      throw new Error("client is not connected");
    }
    if (this.session.state >= ClientState.LoggingIn) {
      throw new Error("client is logging in or already logged in");
    }
    this.session = {
      ...this.session,
      state: ClientState.LoggingIn,
    };
    const msg = new ClientLoginRequest({
      userHash: this.userHash,
      clientId: this.clientId,
      port: this.clientPort,
      nickName: this.nickName,
    });
    const buffer = msg.getBuffer();
    this.socket.write(buffer);
    this.pushLog("[VERBOSE] begin login");
  }

  disconnect() {
    if (this.session.state < ClientState.Connected) {
      throw new Error("client is not connected");
    }
    this.session = {
      ...this.session,
      state: ClientState.Disconnecting,
    };
    this.socket.end();
    this.pushLog("[VERBOSE] begin disconnect");
  }

  search(query: string) {
    if (this.session.state < ClientState.Idle) {
      throw new Error("client is not logged in");
    }
    if (this.session.state === ClientState.Searching) {
      throw new Error("client is searching");
    }
    const msg = new ClientSearchRequest(query);
    const buffer = msg.getBuffer();
    this.socket.write(buffer);
    this.session = {
      ...this.session,
      state: ClientState.Searching,
      lastQuery: query,
    };
    this.pushLog("[VERBOSE] begin search");
  }

  getSession() {
    return {
      ...this.session,
    } as ClientSession;
  }
}

export interface ClientEvents {
  connected: [session: ClientSession];
  idchange: [session: ClientSession];
  searchresult: [session: ClientSession];
  serverstatus: [session: ClientSession];
  servermessage: [session: ClientSession];
  disconnected: [];
  error: [error: Error];
}

export interface ClientSession {
  state: ClientState;
  server?: { host: string; port: number };
  clientId?: number;
  flags?: number;
  users?: number;
  files?: number;
  lastQuery?: string;
  results?: Record<string, SearchResult[]>;
  messages?: string[];
  logs?: string[];
}

export const enum ClientState {
  Disconnecting = -1,
  Disconnected = 0,
  Connecting,
  Connected,
  LoggingIn,
  Idle,
  Searching,
}

export interface ClientOptions {
  uuid?: string;
  nickName?: string;
  clientPort?: number;
}

export interface SearchResult {
  hash: string;
  name?: string;
  size?: number;
  sources?: number;
  completeSources?: number;
}
