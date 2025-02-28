import { BufferWriter, ChunkedBufferWriter } from "../buffer/buffer-writer";
import { ClientVersion, EmuleVersion, ServerFlags } from "../constants";
import { MessageProtocol } from "./message-header";
import { OutgoingMessage } from "./outgoing-message";
import { Query } from "./query";
import { Tag, TagName } from "./tag";

const enum ClientCommand {
  LoginRequest = 0x01,
  GetServerList = 0x14,
  OfferFiles = 0x15,
  SearchRequest = 0x16,
}

export abstract class ClientToServerMessage extends OutgoingMessage<ClientCommand> {
  constructor(command: ClientCommand) {
    super(command, MessageProtocol.EDonkey);
  }
}

//Struct: <User_Hash 16><Client_ID 4><TCP_Port 2><Tag_List>
export class ClientLoginRequest extends ClientToServerMessage {
  constructor(private readonly options: ClientLoginOptions) {
    super(ClientCommand.LoginRequest);
  }

  protected writeBody(writer: ChunkedBufferWriter): void {
    const hash = Buffer.from(this.options.userHash, "hex").subarray(0, 16);
    writer.write(hash);
    writer.writeUInt32(this.options.clientId);
    writer.writeUInt16(this.options.port);

    const tags: Tag[] = [
      new Tag(TagName.Name, this.options.nickName),
      new Tag(TagName.Version, ClientVersion),
      new Tag(TagName.ServerFlags, ServerFlags),
      new Tag(TagName.EmuleVersion, EmuleVersion),
    ];

    writer.writeUInt32(tags.length);
    for (const tag of tags) {
      tag.write(writer);
    }
  }
}

export interface ClientLoginOptions {
  userHash: string;
  clientId: number;
  port: number;
  nickName: string;
}

export class ClientSearchRequest extends ClientToServerMessage {
  constructor(private readonly query: string) {
    super(ClientCommand.SearchRequest);
  }

  protected writeBody(writer: BufferWriter): void {
    const query = new Query(this.query);
    query.write(writer);
  }
}
