// Helpers for the per-run "extra details" (e.g. location) requested on top of the usual CV data

/** Ready-made field for the most common request. The text in parentheses guides Claude. */
export const LOCATION_FIELD = 'Location (town or city only)';

export const MAX_EXTRA_FIELDS = 5;

/** The label without its parenthesised hint, for display: 'Location (town or city only)' -> 'Location' */
export function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)/g, '').trim() || label.trim();
}
