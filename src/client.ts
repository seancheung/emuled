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

export class Client extends EventEmitter<ClientEvents> {
  private readonly nickName: string;
  private readonly clientPort: number;
  private readonly userHash: string;
  protected readonly socket: Socket;
  private clientId: number = 0;
  private session: ClientSession;
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
    this.socket.addListener("error", this.onError);
    this.socket.addListener("close", this.onClose);
    this.socket.addListener("data", this.onReceive);
    this.session = {};
  }

  protected onConnect = () => {
    this.emit("connected", this.session);
  };

  protected onError = (err: Error) => {
    this.emit("error", err);
  };

  protected onClose = () => {
    this.session = {};
    this.emit("disconnected");
  };

  protected onReceive = (data: Buffer) => {
    const protocol = data.readUInt8();
    switch (protocol) {
      case MessageProtocol.EMule:
      case MessageProtocol.EDonkey:
      case MessageProtocol.Packed:
        {
          const message = new IncomingMessage<ServerCommand>(data);
          if (!message.isComplete) {
            this.pendingMessage = message;
          } else {
            this.dispatchMessage(message).catch(this.onError);
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
            this.dispatchMessage(message).catch(this.onError);
          }
        }
        break;
    }
  };

  protected async dispatchMessage(message: IncomingMessage<ServerCommand>) {
    const header = message.header;
    const data = await message.getBody();
    switch (header.command) {
      case ServerCommand.ServerMessage:
        {
          const body = new ServerGeneralMessageBody(data);
          this.pushMessage(body.message);
          this.emit("servermessage", this.session);
        }
        break;
      case ServerCommand.IDChange:
        {
          const body = new ServerIDChangeMessageBody(data);
          this.clientId = body.newId;
          this.session.clientId = body.newId;
          this.session.flags = body.flags;
          this.emit("idchange", this.session);
        }
        break;
      case ServerCommand.ServerStatus:
        {
          const body = new ServerStatusMessageBody(data);
          this.session.users = body.users;
          this.session.files = body.files;
          this.emit("serverstatus", this.session);
        }
        break;
      case ServerCommand.SearchResult:
        {
          const body = new ServerSearchResultMessageBody(data);
          this.session.results = {
            ...this.session.results,
            [this.session.lastQuery || "Files"]: body.results,
          };
          this.emit("searchresult", this.session);
        }
        break;
      default:
        return;
    }
  }

  protected login() {
    const msg = new ClientLoginRequest({
      userHash: this.userHash,
      clientId: this.clientId,
      port: this.clientPort,
      nickName: this.nickName,
    });
    const buffer = msg.getBuffer();
    this.socket.write(buffer);
  }

  protected pushMessage(message: string) {
    if (!this.session.messages) {
      this.session.messages = [];
    }
    this.session.messages = [...this.session.messages, message];
  }

  connect(host: string, port: number) {
    this.session = {
      host,
      port,
    };
    this.socket.connect(port, host, this.onConnect);
  }

  disconnect() {
    this.socket.end();
  }

  search(query: string) {
    const msg = new ClientSearchRequest(query);
    const buffer = msg.getBuffer();
    this.socket.write(buffer);
    this.session.lastQuery = query;
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
  host?: string;
  port?: number;
  clientId?: number;
  flags?: number;
  users?: number;
  files?: number;
  lastQuery?: string;
  results?: Record<string, SearchResultEntry[]>;
  messages?: string[];
}

export interface ClientOptions {
  uuid?: string;
  nickName?: string;
  clientPort?: number;
}
