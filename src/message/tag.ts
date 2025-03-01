import assert from "assert";
import { BufferReader } from "../buffer/buffer-reader";
import { BufferWriter } from "../buffer/buffer-writer";

export const enum TagType {
  String = 0x02,
  UInt32 = 0x03,
}

export const enum TagName {
  Name = 0x01,
  Version = 0x11,
  ServerFlags = 0x20,
  EmuleVersion = 0xfb,
}

export const enum FileTag {
  FileName = 0x01,
  FileSize = 0x02,
  FileSources = 0x15,
  FileCompleteSources = 0x30,
}

export interface TagData {
  readonly type: TagType;
  readonly name: number | string;
  readonly value: number | string;
}

export interface StringTag extends TagData {
  readonly type: TagType.String;
  readonly name: number | string;
  readonly value: string;
}

export interface NumberTag extends TagData {
  readonly type: TagType.UInt32;
  readonly name: number | string;
  readonly value: number;
}

export class Tag implements TagData {
  public readonly type: TagType;
  public readonly name: number | string;
  public readonly value: number | string;

  constructor(name: string | number, value: string | number) {
    this.name = name;
    this.value = value;
    this.type = typeof value === "number" ? TagType.UInt32 : TagType.String;
  }

  write(writer: BufferWriter): void {
    writer.writeUInt8(this.type);

    if (typeof this.name === "number") {
      writer.writeUInt16(1);
      writer.writeUInt8(this.name);
    } else if (typeof this.name === "string") {
      writer.writeUInt16String(this.name);
    } else {
      throw new Error("unknown tag name type");
    }

    switch (this.type) {
      case TagType.String:
        {
          assert(typeof this.value === "string");
          writer.writeUInt16String(this.value);
        }
        break;
      case TagType.UInt32:
        {
          assert(typeof this.value === "number");
          writer.writeUInt32(this.value);
        }
        break;
      default:
        throw new Error("unknown tag type");
    }
  }

  static read(reader: BufferReader): StringTag | NumberTag | undefined {
    let type = reader.readUInt8();
    let name: number | string;
    if (type & 0x80) {
      // NOTE: masked
      type &= 0x7f;
      name = reader.readUInt8();
    } else {
      const len = reader.readUInt16();
      if (len === 1) {
        name = reader.readUInt8();
      } else {
        name = reader.readString(len);
      }
    }

    let value: number | string | undefined;
    switch (type) {
      case TagType.String:
        value = reader.readUInt16String();
        break;
      case TagType.UInt32:
        value = reader.readUInt32();
        break;
      case 0x0b: // UInt64
        reader.seek(8);
        break;
      case 0x08: // UInt16
        value = reader.readUInt16();
        break;
      case 0x09: // UInt8
        value = reader.readUInt8();
        break;
      case 0x04: // Float32
        reader.seek(4);
        break;
      case 0x01: // Hash
        reader.seek(16);
        break;
      case 0x05: // Boolean
        reader.seek(1);
        break;
      case 0x06: // Boolean Array
        reader.seek(reader.readUInt16() / 8 + 1);
        break;
      case 0x07: // Blob
        reader.seek(reader.readUInt32());
        break;
      default:
        {
          if (type >= 0x11 && type <= 0x20) {
            const len = type - 0x11 + 1;
            value = reader.readString(len);
          } else {
            throw new Error("unknown tag type");
          }
        }
        break;
    }

    if (value != null) {
      return {
        type,
        name,
        value,
      } as StringTag | NumberTag;
    }
  }
}
