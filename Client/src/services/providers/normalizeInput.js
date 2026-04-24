/**
 * Normalize user input into a full URL suitable for proxy encoding.
 *
 * - Already a URL → return as-is
 * - Looks like a domain (has dot, no spaces) → prepend https://
 * - Otherwise → DuckDuckGo search query
 */
export function normalizeInput(raw) {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}
