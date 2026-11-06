// localStorage/sessionStorage wrapper with type safety

import type { ParseMode, ConcurrencyLevel } from '../types';

// Keys written by older versions of the app that are no longer used
const LEGACY_KEYS = ['ll2lo_ai_provider', 'll2lo_anthropic_model'] as const;

const STORAGE_KEYS = {
  API_KEY: 'll2lo_api_key',
  CONCURRENCY_LEVEL: 'll2lo_concurrency_level',
  THEME: 'theme',
  PARSE_MODE: 'll2lo_parse_mode',
} as const;

export class StorageService {
  /**
   * Remove settings left behind by older versions of the app
   */
  static removeLegacyKeys(): void {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  }

  /**
   * Save API key to localStorage
   */
  static saveApiKey(key: string): void {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  }

  /**
   * Get API key from localStorage
   */
  static getApiKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
  }

  /**
   * Remove API key from localStorage
   */
  static removeApiKey(): void {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }

  /**
   * Save theme preference (system/light/dark)
   */
  static saveTheme(theme: 'system' | 'light' | 'dark'): void {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  /**
   * Get theme preference
   * Returns user's preference: 'system', 'light', or 'dark'
   * Defaults to 'system' (auto) for first-time users
   */
  static getTheme(): 'system' | 'light' | 'dark' {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);

    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Default to system (auto) for first-time users
    return 'system';
  }

  /**
   * Get the actual theme to apply to UI
   * Resolves 'system' preference to 'light' or 'dark' based on OS setting
   */
  static getActualTheme(): 'light' | 'dark' {
    const preference = this.getTheme();

    if (preference === 'system') {
      // Detect system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
      // Final fallback: dark mode (for Finland winters 🌙)
      return 'dark';
    }

    return preference; // 'light' or 'dark'
  }

  /**
   * Save parse mode preference
   */
  static saveParseMode(mode: ParseMode): void {
    localStorage.setItem(STORAGE_KEYS.PARSE_MODE, mode);
  }

  /**
   * Get parse mode preference
   * Defaults to 'longlist' for first-time users
   */
  static getParseMode(): ParseMode {
    const stored = localStorage.getItem(STORAGE_KEYS.PARSE_MODE);
    return (stored === 'individual' || stored === 'longlist') ? stored : 'longlist';
  }

  /**
   * Save concurrency level preference
   */
  static saveConcurrencyLevel(level: ConcurrencyLevel): void {
    localStorage.setItem(STORAGE_KEYS.CONCURRENCY_LEVEL, level.toString());
  }

  /**
   * Get concurrency level preference
   * Defaults to 1 (safest for low API usage tiers - prevents 429 errors)
   */
  static getConcurrencyLevel(): ConcurrencyLevel {
    const stored = localStorage.getItem(STORAGE_KEYS.CONCURRENCY_LEVEL);
    const level = parseInt(stored || '1', 10);
    return (level >= 1 && level <= 5) ? level as ConcurrencyLevel : 1;
  }

  /**
   * Clear all app data from storage
   */
  static clearAll(): void {
    [...Object.values(STORAGE_KEYS), ...LEGACY_KEYS].forEach(key => {
      localStorage.removeItem(key);
    });
  }
}
