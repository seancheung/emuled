import { BufferReader } from "../buffer/buffer-reader";
import { NumberTag, StringTag, Tag } from "./tag";

export const enum ServerCommand {
  Reject = 0x05,
  ServerList = 0x32,
  SearchResult = 0x33,
  ServerStatus = 0x34,
  ServerMessage = 0x38,
  IDChange = 0x40,
  ServerIdent = 0x41,
}

export abstract class ServerToClientMessageBody {
  constructor(data: Buffer) {}
}

export class ServerIDChangeMessageBody extends ServerToClientMessageBody {
  public readonly newId: number;
  public readonly flags: number;

  constructor(data: Buffer) {
    super(data);
    const reader = new BufferReader(data);
    this.newId = reader.readUInt32();
    this.flags = reader.readUInt32();
  }
}

export class ServerGeneralMessageBody extends ServerToClientMessageBody {
  public readonly message: string;

  constructor(data: Buffer) {
    super(data);
    const reader = new BufferReader(data);
    this.message = reader.readUInt16String();
  }
}

export class ServerStatusMessageBody extends ServerToClientMessageBody {
  public readonly users: number;
  public readonly files: number;

  constructor(data: Buffer) {
    super(data);
    const reader = new BufferReader(data);
    this.users = reader.readUInt32();
    this.files = reader.readUInt32();
  }
}

export class ServerSearchResultMessageBody extends ServerToClientMessageBody {
  public readonly results: SearchResultEntry[];

  constructor(data: Buffer) {
    super(data);
    const reader = new BufferReader(data);
    const count = reader.readUInt32();
    const list: SearchResultEntry[] = Array(count);
    for (let i = 0; i < count; i++) {
      const hash = reader.readString(16, "hex");
      const clientId = reader.readUInt32();
      const clientPort = reader.readUInt16();
      const tagCount = reader.readUInt32();
      const tags: Array<StringTag | NumberTag> = [];
      for (let j = 0; j < tagCount; j++) {
        const tag = Tag.read(reader);
        if (tag) {
          // NOTE: unsupported tag types omitted
          tags.push(tag);
        }
      }
      list[i] = {
        hash,
        clientId,
        clientPort,
        tags,
      };
    }
    this.results = list;
  }
}

export interface SearchResultEntry {
  hash: string;
  clientId: number;
  clientPort: number;
  tags: Array<StringTag | NumberTag>;
}
