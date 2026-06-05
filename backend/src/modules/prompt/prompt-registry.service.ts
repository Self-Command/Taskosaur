import { Injectable, Logger } from '@nestjs/common';
import { SECTION_VARIANTS, PromptSection } from './sections';

interface LocaleConfig {
  label: string;
  fallback: string | null;
  date_locale: string;
}

interface SectionMeta {
  type: 'cosmetic' | 'semantic';
}

// ── Inline registry — single source of truth, no YAML parse at runtime ──
const LOCALES: Record<string, LocaleConfig> = {
  en: { label: 'English', fallback: null, date_locale: 'en-US' },
  zh: { label: '简体中文', fallback: 'en', date_locale: 'zh-CN' },
};

const SECTIONS: Record<string, SectionMeta> = {
  identity: { type: 'cosmetic' },
  current_time: { type: 'cosmetic' },
  date_rules: { type: 'semantic' },
  web_search: { type: 'cosmetic' },
  general_rules: { type: 'semantic' },
  formatting: { type: 'cosmetic' },
};

@Injectable()
export class PromptRegistry {
  private readonly logger = new Logger('PromptRegistry');

  /**
   * Get locale configuration (date locale, fallback chain).
   * Falls back to 'en' for unknown locales.
   */
  getLocaleConfig(locale: string): LocaleConfig {
    return LOCALES[locale] ?? LOCALES['en'];
  }

  /**
   * Get a section in the requested locale.
   * Falls back: locale → fallback chain → 'en' (guaranteed to exist).
   */
  get(key: string, locale: string): PromptSection {
    const variants = SECTION_VARIANTS.get(key);
    if (!variants) {
      this.logger.warn(`Unknown section "${key}", falling back to empty`);
      return { key, render: () => '' };
    }

    // 1. Exact match
    if (variants.has(locale)) return variants.get(locale)!;

    // 2. Follow fallback chain
    const config = this.getLocaleConfig(locale);
    if (config.fallback && variants.has(config.fallback)) {
      return variants.get(config.fallback)!;
    }

    // 3. Ultimate fallback: English
    if (variants.has('en')) return variants.get('en')!;

    // Should never reach here — 'en' is always registered
    return { key, render: () => '' };
  }

  /** All section keys in composition order. */
  getSectionKeys(): string[] {
    return ['current_time', 'identity', 'date_rules', 'web_search', 'general_rules', 'formatting'];
  }

  /** Get supported locales (for admin UI, etc.) */
  getSupportedLocales(): string[] {
    return Object.keys(LOCALES);
  }
}
