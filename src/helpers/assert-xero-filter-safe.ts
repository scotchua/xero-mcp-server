const GUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Validate that a value is a well-formed GUID before it is interpolated into
 * a Xero `where` filter string (e.g. `guid("${value}")`). A strict GUID
 * cannot contain the filter language's metacharacters, which closes off
 * filter/query injection through that parameter.
 */
export function assertGuidForFilter(value: string, paramName: string): string {
  if (!GUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${paramName}: expected a GUID`);
  }
  return value;
}

/**
 * Validate that a free-text value is safe to interpolate into a quoted Xero
 * `where` filter string literal (e.g. `=="${value}"`). Xero's filter
 * language has no documented escaping for embedded quotes, so a value
 * containing one is rejected rather than guessed at.
 */
export function assertSafeFilterString(value: string, paramName: string): string {
  if (value.includes('"') || value.includes("\\")) {
    throw new Error(
      `Invalid ${paramName}: must not contain quote or backslash characters`,
    );
  }
  return value;
}
