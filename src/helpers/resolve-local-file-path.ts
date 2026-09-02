import path from "path";

/**
 * Resolve a caller-supplied file path for reading, confined to XERO_FILES_DIR.
 *
 * A tool that reads a local file at a caller-supplied path is a file-disclosure
 * risk if the process can be asked to read anything it has access to (e.g.
 * `~/.ssh/id_rsa`, a `.env` with client secrets) and hand it back as, say, a
 * Xero attachment. Without XERO_FILES_DIR configured, filePath uploads are
 * refused entirely — base64 input still works. With it configured, only
 * paths that resolve inside that directory are allowed.
 */
export function resolveLocalFilePath(filePath: string): string {
  const filesDir = process.env.XERO_FILES_DIR;
  if (!filesDir) {
    throw new Error(
      "Reading a local file path requires XERO_FILES_DIR to be set to the directory " +
        "callers may read from. Pass the file content as base64 instead, or set XERO_FILES_DIR.",
    );
  }

  const resolvedDir = path.resolve(filesDir);
  const resolvedPath = path.resolve(resolvedDir, filePath);
  const relative = path.relative(resolvedDir, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Invalid filePath: must resolve inside XERO_FILES_DIR (${resolvedDir})`,
    );
  }
  return resolvedPath;
}
