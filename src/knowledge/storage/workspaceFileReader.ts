import { createHash } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;
const PRIVATE_KEY_BASENAME_RE = /^(id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|key))$/i;

export type WorkspaceFileReadErrorCode =
  | "INVALID_RELATIVE_PATH"
  | "PATH_ESCAPE"
  | "SENSITIVE_FILE"
  | "NOT_REGULAR_FILE"
  | "FILE_TOO_LARGE"
  | "FILE_CHANGED_DURING_CAPTURE";

export class WorkspaceFileReadError extends Error {
  constructor(
    readonly code: WorkspaceFileReadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceFileReadError";
  }
}

export interface CapturedWorkspaceFile {
  relativePath: string;
  canonicalPath: string;
  bytes: Buffer;
  byteLength: number;
  contentSha256: string;
}

export interface WorkspaceFileReaderOptions {
  maxBytes?: number;
  /** Test-only deterministic race hook; production callers should omit it. */
  afterReadBeforePathRecheckForTest?: () => void | Promise<void>;
}

export async function captureWorkspaceFile(
  workspaceRoot: string,
  requestedRelativePath: string,
  options: WorkspaceFileReaderOptions = {},
): Promise<CapturedWorkspaceFile> {
  const relativePath = validateRelativePath(requestedRelativePath);
  assertNotSensitive(relativePath);

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive safe integer");
  }

  const canonicalRoot = await realpath(workspaceRoot);
  const lexicalPath = path.resolve(canonicalRoot, relativePath);
  assertContained(canonicalRoot, lexicalPath);

  const canonicalPath = await realpath(lexicalPath);
  assertContained(canonicalRoot, canonicalPath);

  const pathBefore = await stat(canonicalPath);
  if (!pathBefore.isFile()) {
    throw new WorkspaceFileReadError("NOT_REGULAR_FILE", "Selected Workspace path is not a regular file");
  }
  if (pathBefore.size > maxBytes) {
    throw new WorkspaceFileReadError(
      "FILE_TOO_LARGE",
      `Selected Workspace file is ${String(pathBefore.size)} bytes; maximum is ${String(maxBytes)}`,
    );
  }

  const handle = await open(canonicalPath, "r");
  try {
    const openedBefore = await handle.stat();
    if (!sameFileIdentity(pathBefore, openedBefore)) {
      throw changedDuringCapture();
    }

    const bytes = Buffer.alloc(openedBefore.size);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset !== bytes.length) throw changedDuringCapture();

    const openedAfter = await handle.stat();
    if (!sameFileSnapshot(openedBefore, openedAfter)) throw changedDuringCapture();

    await options.afterReadBeforePathRecheckForTest?.();

    let pathAfterCanonical: string;
    try {
      pathAfterCanonical = await realpath(lexicalPath);
    } catch {
      throw changedDuringCapture();
    }
    assertContained(canonicalRoot, pathAfterCanonical);
    const pathAfter = await stat(pathAfterCanonical);
    if (!sameFileIdentity(openedAfter, pathAfter) || !sameFileSnapshot(openedAfter, pathAfter)) {
      throw changedDuringCapture();
    }

    return {
      relativePath,
      canonicalPath: pathAfterCanonical,
      bytes,
      byteLength: bytes.byteLength,
      contentSha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    await handle.close();
  }
}

export function validateRelativePath(input: string): string {
  if (!input || input.includes("\0") || path.isAbsolute(input)) {
    throw new WorkspaceFileReadError("INVALID_RELATIVE_PATH", "Workspace file path must be a non-empty relative path");
  }

  const normalized = path.normalize(input);
  if (normalized === "." || normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new WorkspaceFileReadError("INVALID_RELATIVE_PATH", "Workspace file path cannot traverse above the Workspace root");
  }

  return normalized;
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    return;
  }
  throw new WorkspaceFileReadError("PATH_ESCAPE", "Selected Workspace file resolves outside the Workspace root");
}

function assertNotSensitive(relativePath: string): void {
  const components = relativePath.split(path.sep).filter(Boolean);
  const lower = components.map((component) => component.toLowerCase());
  const basename = components.at(-1) ?? "";

  if (
    lower.some((component) => component === ".ssh") ||
    basename.toLowerCase() === ".env" ||
    basename.toLowerCase().startsWith(".env.") ||
    PRIVATE_KEY_BASENAME_RE.test(basename)
  ) {
    throw new WorkspaceFileReadError("SENSITIVE_FILE", "Selected Workspace file matches a sensitive-file guard");
  }
}

function sameFileIdentity(
  left: { dev: number | bigint; ino: number | bigint },
  right: { dev: number | bigint; ino: number | bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileSnapshot(
  left: { dev: number | bigint; ino: number | bigint; size: number; mtimeMs: number; ctimeMs: number },
  right: { dev: number | bigint; ino: number | bigint; size: number; mtimeMs: number; ctimeMs: number },
): boolean {
  return (
    sameFileIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs
  );
}

function changedDuringCapture(): WorkspaceFileReadError {
  return new WorkspaceFileReadError(
    "FILE_CHANGED_DURING_CAPTURE",
    "Workspace file changed or was replaced while it was being captured",
  );
}
