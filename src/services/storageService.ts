// localStorage/sessionStorage wrapper with type safety

import type { ParseMode, AiProvider, AnthropicModel, ConcurrencyLevel } from '../types';

const STORAGE_KEYS = {
  API_KEY: 'll2lo_api_key',
  AI_PROVIDER: 'll2lo_ai_provider',
  ANTHROPIC_MODEL: 'll2lo_anthropic_model',
  CONCURRENCY_LEVEL: 'll2lo_concurrency_level',
  THEME: 'theme',
  PARSE_MODE: 'll2lo_parse_mode',
} as const;

export class StorageService {
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
   * Save AI provider preference to localStorage
   */
  static saveAiProvider(provider: AiProvider): void {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider);
  }

  /**
   * Get AI provider preference from localStorage
   * Defaults to 'anthropic' for first-time users
   */
  static getAiProvider(): AiProvider {
    const stored = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER);
    return (stored === 'openai' || stored === 'anthropic') ? stored : 'anthropic';
  }

  /**
   * Save Anthropic model preference to localStorage
   */
  static saveAnthropicModel(model: AnthropicModel): void {
    localStorage.setItem(STORAGE_KEYS.ANTHROPIC_MODEL, model);
  }

  /**
   * Get Anthropic model preference from localStorage
   * Defaults to 'claude-sonnet-5' (latest balanced model)
   */
  static getAnthropicModel(): AnthropicModel {
    const stored = localStorage.getItem(STORAGE_KEYS.ANTHROPIC_MODEL);
    const validModels: AnthropicModel[] = [
      'claude-haiku-4-5-20251001',
      'claude-sonnet-5',
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251101',
    ];
    return validModels.includes(stored as AnthropicModel)
      ? (stored as AnthropicModel)
      : 'claude-sonnet-5';
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
   * Defaults to 1 (safest for free tier / Tier 1 - prevents 429 errors)
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
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}
