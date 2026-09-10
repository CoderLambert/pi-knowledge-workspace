import { createHash, timingSafeEqual } from "node:crypto";

export interface Utf8ByteRange {
  startByte: number;
  endByte: number;
}

export class InvalidUtf8RangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUtf8RangeError";
  }
}

/**
 * Validates an Evidence-style half-open UTF-8 byte range against authoritative
 * canonical artifact bytes. Offsets are byte offsets, never JS string indexes.
 */
export function assertValidUtf8Range(bytes: Uint8Array, range: Utf8ByteRange): void {
  assertCanonicalUtf8(bytes);
  const { startByte, endByte } = range;

  if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte)) {
    throw new InvalidUtf8RangeError("UTF-8 byte range offsets must be safe integers");
  }
  if (startByte < 0 || endByte < startByte || endByte > bytes.byteLength) {
    throw new InvalidUtf8RangeError(
      `UTF-8 byte range [${String(startByte)}, ${String(endByte)}) is outside canonical byte length ${String(bytes.byteLength)}`,
    );
  }
  if (!isUtf8Boundary(bytes, startByte)) {
    throw new InvalidUtf8RangeError(`startByte ${String(startByte)} is not a UTF-8 code-point boundary`);
  }
  if (!isUtf8Boundary(bytes, endByte)) {
    throw new InvalidUtf8RangeError(`endByte ${String(endByte)} is not a UTF-8 code-point boundary`);
  }
}

export function sliceUtf8Range(bytes: Uint8Array, range: Utf8ByteRange): Uint8Array {
  assertValidUtf8Range(bytes, range);
  return bytes.slice(range.startByte, range.endByte);
}

export function extractExactQuote(bytes: Uint8Array, range: Utf8ByteRange): string {
  const slice = sliceUtf8Range(bytes, range);
  return new TextDecoder("utf-8", { fatal: true }).decode(slice);
}

/** Hashes the exact authoritative bytes addressed by the range. */
export function hashUtf8Range(bytes: Uint8Array, range: Utf8ByteRange): string {
  return createHash("sha256").update(sliceUtf8Range(bytes, range)).digest("hex");
}

/**
 * Verifies both the stored quote and quote hash against authoritative bytes.
 * This deliberately performs no Unicode normalization or fuzzy matching.
 */
export function verifyExactQuote(
  bytes: Uint8Array,
  range: Utf8ByteRange,
  expectedQuote: string,
  expectedQuoteHash: string,
): boolean {
  const slice = sliceUtf8Range(bytes, range);
  const expectedBytes = Buffer.from(expectedQuote, "utf8");
  if (slice.byteLength !== expectedBytes.byteLength) return false;
  if (!timingSafeEqual(Buffer.from(slice), expectedBytes)) return false;

  if (!/^[0-9a-f]{64}$/.test(expectedQuoteHash)) return false;
  const actualHash = createHash("sha256").update(slice).digest();
  const expectedHash = Buffer.from(expectedQuoteHash, "hex");
  return timingSafeEqual(actualHash, expectedHash);
}

function assertCanonicalUtf8(bytes: Uint8Array): void {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new InvalidUtf8RangeError(`Canonical artifact bytes are not valid UTF-8: ${String(error)}`);
  }
}

function isUtf8Boundary(bytes: Uint8Array, offset: number): boolean {
  if (offset === 0 || offset === bytes.byteLength) return true;
  const byte = bytes[offset];
  if (byte === undefined) return false;
  return (byte & 0xc0) !== 0x80;
}
