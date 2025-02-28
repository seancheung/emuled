import { BufferWriter, ChunkedBufferWriter } from "../buffer/buffer-writer";
import { MessageHeader, MessageProtocol } from "./message-header";

export abstract class OutgoingMessage<TCommand extends number> {
  protected constructor(
    protected readonly command: TCommand,
    protected readonly protocol: MessageProtocol
  ) {}

  getBuffer(): Buffer {
    const writer = new ChunkedBufferWriter();
    this.writeBody(writer);
    const header = new MessageHeader(
      this.protocol,
      writer.length,
      this.command
    );
    const body = writer.getBuffer();

    return Buffer.concat([header.getBuffer(), body]);
  }

  protected abstract writeBody(writer: BufferWriter): void;
}
