import { BufferWriter } from "../buffer/buffer-writer";

const enum ParamType {
  Boolean = 0x0,
  String = 0x1,
}
const enum OperatorType {
  And = 0x00,
  Or = 0x01,
  Not = 0x02,
}

export class Query {
  private parsed: QueryOperator | string;
  constructor(rawQuery: string) {
    this.parsed = rawQuery;
    // TODO: parse
  }

  write(writer: BufferWriter): void {
    this._write(writer, this.parsed);
  }

  private _write(writer: BufferWriter, value: QueryOperator | string) {
    if (typeof value === "string") {
      writer.writeUInt8(ParamType.String);
      writer.writeUInt32String(value);
    } else {
      writer.writeUInt8(ParamType.Boolean);
      writer.writeUInt8(value.type);
      this._write(writer, value.left);
      this._write(writer, value.right);
    }
  }
}

export interface QueryOperator {
  type: OperatorType;
  left: string | QueryOperator;
  right: string | QueryOperator;
}
