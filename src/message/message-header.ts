import { BufferReader } from "../buffer/buffer-reader";
import { FixedBufferWriter } from "../buffer/buffer-writer";
import { MessageHeaderSize } from "../constants";

export const enum MessageProtocol {
  EDonkey = 0xe3,
  EMule = 0xc5,
  Packed = 0xd4,
}

export class MessageHeader<TCommand extends number> {
  readonly protocol: MessageProtocol;
  readonly size: number;
  readonly command: TCommand;

  constructor(protocol: number, size: number, command: TCommand) {
    this.protocol = protocol;
    this.size = size;
    this.command = command;
  }

  getBuffer() {
    const buffer = Buffer.allocUnsafe(MessageHeaderSize);
    const writer = new FixedBufferWriter(buffer);
    writer.writeUInt8(this.protocol);
    writer.writeUInt32(this.size + 1); // NOTE:
    writer.writeUInt8(this.command);
    return buffer;
  }

  static from(buffer: Buffer) {
    const reader = new BufferReader(buffer);
    const protocol = reader.readUInt8();
    const size = Math.max(0, reader.readUInt32() - 1); // NOTE:
    const command = reader.readUInt8();

    return new MessageHeader(protocol, size, command);
  }
}
