/**
 * Input sanitization utilities to prevent XSS and injection attacks.
 * Applied at the DB layer before any data is persisted.
 */

// Strip HTML tags — prevents stored XSS when rendered in UI
const HTML_TAG_RE = /<[^>]*>/g;

// Strip potentially dangerous attributes/patterns even if tags are stripped
const SCRIPT_RE = /javascript\s*:/gi;
const EVENT_RE = /\bon\w+\s*=/gi;
const DATA_URI_RE = /data\s*:\s*text\/html/gi;

/**
 * Sanitize a text string: strip HTML tags, script URIs, event handlers.
 * Returns cleaned string. Null/undefined pass through.
 */
export function sanitizeText(input: string): string;
export function sanitizeText(input: string | null | undefined): string | null | undefined;
export function sanitizeText(input: string | null | undefined): string | null | undefined {
  if (input == null) return input;
  return input
    .replace(HTML_TAG_RE, '')
    .replace(SCRIPT_RE, '')
    .replace(EVENT_RE, '')
    .replace(DATA_URI_RE, '')
    .trim();
}

/**
 * Sanitize an object's string fields in-place.
 * Only sanitizes specified keys (shallow).
 */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  keys: (keyof T)[]
): T {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string') {
      (obj as Record<string, unknown>)[key as string] = sanitizeText(val);
    }
  }
  return obj;
}
