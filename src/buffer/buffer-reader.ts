export class BufferReader<
  TArrayBuffer extends ArrayBufferLike = ArrayBufferLike
> {
  private offset: number = 0;
  constructor(private readonly buffer: Buffer<TArrayBuffer>) {}

  readUInt32() {
    const value = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  readUInt16() {
    const value = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  readUInt8() {
    const value = this.buffer.readUInt8(this.offset);
    this.offset += 1;
    return value;
  }

  readUInt64() {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  readString(len: number, encoding: BufferEncoding = "utf-8") {
    const value = this.buffer.toString(
      encoding,
      this.offset,
      this.offset + len
    );
    this.offset += len;
    return value;
  }

  readUInt32String() {
    const len = this.readUInt32();
    return this.readString(len);
  }

  readUInt16String() {
    const len = this.readUInt16();
    return this.readString(len);
  }

  read(len: number) {
    const value = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len;
    return value;
  }

  seek(len: number) {
    this.offset += len;
  }
}
