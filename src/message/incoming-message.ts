import { unzip } from "zlib";
import { FixedBufferWriter } from "../buffer/buffer-writer";
import { MessageHeaderSize } from "../constants";
import { MessageHeader, MessageProtocol } from "./message-header";

export class IncomingMessage<TCommand extends number> {
  public readonly header: MessageHeader<TCommand>;
  private readonly body: Buffer;
  private readonly writer: FixedBufferWriter;

  constructor(chunk: Buffer) {
    const header = MessageHeader.from(chunk);
    this.header = header as MessageHeader<TCommand>;
    this.body = Buffer.allocUnsafe(header.size);
    this.writer = new FixedBufferWriter(this.body);
    this.writer.write(chunk.subarray(MessageHeaderSize));
  }

  get isComplete() {
    return this.writer.length >= this.header.size;
  }

  get isPacked() {
    return this.header.protocol === MessageProtocol.Packed;
  }

  write(chunk: Buffer) {
    if (this.isComplete) {
      throw new Error("cannot write to a complete message");
    }
    this.writer.write(chunk);
  }

  async getBody(): Promise<Buffer> {
    if (!this.isComplete) {
      throw new Error("message is incomplete");
    }
    if (this.isPacked) {
      return new Promise<Buffer>((resolve, reject) => {
        unzip(this.body, (err, unpacked) => {
          if (err) {
            reject(err);
          } else {
            resolve(unpacked);
          }
        });
      });
    }
    return this.body;
  }
}
