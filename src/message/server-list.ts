import { BufferReader } from "../buffer/buffer-reader";
import { PartFileVersion } from "../constants";
import { NumberTag, StringTag, Tag, TagName } from "./tag";

export class ServerList {
  constructor(readonly servers: ServerListItem[]) {}

  static from(buffer: Buffer) {
    const reader = new BufferReader(buffer);
    if (reader.readUInt8() !== PartFileVersion) {
      throw new Error("Invalid met version");
    }
    const count = reader.readUInt32();
    const list: ServerListItem[] = [];
    for (let i = 0; i < count; i++) {
      const ip = reader.readUInt32();
      const ipAddr =
        ip === 0
          ? ""
          : `${ip & 0xff}.${(ip >>> 8) & 0xff}.${(ip >>> 16) & 0xff}.${
              (ip >>> 24) & 0xff
            }`;
      const port = reader.readUInt16();
      const tagCount = reader.readUInt32();
      const tags: Array<StringTag | NumberTag> = [];
      for (let j = 0; j < tagCount; j++) {
        const tag = Tag.read(reader);
        if (tag) {
          // NOTE: unsupported tag types omitted
          tags.push(tag);
        }
      }
      list.push(new ServerListItem(ipAddr, port, tags));
    }
    return new ServerList(list);
  }
}

export class ServerListItem {
  readonly name: string;
  constructor(
    readonly ip: string,
    readonly port: number,
    readonly tags: ReadonlyArray<StringTag | NumberTag>
  ) {
    this.name =
      (tags.find((e) => e.name === TagName.Name)?.value as string) || "";
  }
}
