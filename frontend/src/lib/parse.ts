// Defensive parsing for DB-stored JSON strings (L5/L13): malformed data renders as an
// empty or explicit-error state instead of crashing the page.

export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// Question options: a valid array of strings, or null — the caller must show an error,
// never placeholder choices a student might select.
export function parseOptions(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((o) => typeof o === 'string') ? parsed : null;
  } catch {
    return null;
  }
}
