export interface BufferWriter {
  writeUInt32(value: number): void;
  writeUInt16(value: number): void;
  writeUInt8(value: number): void;
  writeString(value: string): void;
  writeUInt32String(value: string): void;
  writeUInt16String(value: string): void;
  write(chunk: Buffer): void;
  readonly length: number;
}

export class FixedBufferWriter<
  TArrayBuffer extends ArrayBufferLike = ArrayBufferLike
> implements BufferWriter
{
  private offset: number = 0;
  constructor(private readonly buffer: Buffer<TArrayBuffer>) {}

  get length() {
    return this.offset;
  }

  writeUInt32(value: number) {
    this.offset = this.buffer.writeUInt32LE(value, this.offset);
  }

  writeUInt16(value: number) {
    this.offset = this.buffer.writeUInt16LE(value, this.offset);
  }

  writeUInt8(value: number) {
    this.offset = this.buffer.writeUInt8(value, this.offset);
  }

  writeString(value: string) {
    const len = this.buffer.write(value, this.offset, "utf-8");
    this.offset += len;
  }

  writeUInt32String(value: string): void {
    const chunk = Buffer.from(value, "utf-8");
    this.writeUInt32(chunk.length);
    this.write(chunk);
  }

  writeUInt16String(value: string): void {
    const chunk = Buffer.from(value, "utf-8");
    this.writeUInt16(chunk.length);
    this.write(chunk);
  }

  write(chunk: Buffer) {
    const len = chunk.copy(this.buffer, this.offset);
    this.offset += len;
  }
}

export class ChunkedBufferWriter implements BufferWriter {
  private readonly chunks: Array<Buffer>;
  private offset: number = 0;
  constructor() {
    this.chunks = [];
  }

  get length() {
    return this.offset;
  }

  writeUInt32(value: number) {
    const chunk = Buffer.allocUnsafe(4);
    chunk.writeUInt32LE(value);
    this.write(chunk);
  }

  writeUInt16(value: number) {
    const chunk = Buffer.allocUnsafe(2);
    chunk.writeUInt16LE(value);
    this.write(chunk);
  }

  writeUInt8(value: number) {
    const chunk = Buffer.allocUnsafe(1);
    chunk.writeUInt8(value);
    this.write(chunk);
  }

  writeString(value: string) {
    const chunk = Buffer.from(value, "utf-8");
    this.write(chunk);
  }

  writeUInt32String(value: string): void {
    const chunk = Buffer.from(value, "utf-8");
    this.writeUInt32(chunk.length);
    this.write(chunk);
  }

  writeUInt16String(value: string): void {
    const chunk = Buffer.from(value, "utf-8");
    this.writeUInt16(chunk.length);
    this.write(chunk);
  }

  write(chunk: Buffer) {
    this.chunks.push(chunk);
    this.offset += chunk.length;
  }

  getBuffer() {
    return Buffer.concat(this.chunks, this.offset);
  }
}
