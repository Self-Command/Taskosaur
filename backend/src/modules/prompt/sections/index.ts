// Barrel export — all section variants registered by locale
import { PromptSection } from './types';

import { identityEN, identityZH } from './identity';
import { currentTimeEN, currentTimeZH } from './current-time';
import { dateRulesEN, dateRulesZH } from './date-rules';
import { webSearchEN, webSearchZH } from './web-search';
import { generalRulesEN, generalRulesZH } from './general-rules';
import { formatting } from './formatting';

export { PromptSection, PromptContext } from './types';

/** All registered section variants: Map<sectionKey, Map<locale, PromptSection>> */
export const SECTION_VARIANTS = new Map<string, Map<string, PromptSection>>();

function register(section: PromptSection, locale: string): void {
  if (!SECTION_VARIANTS.has(section.key)) {
    SECTION_VARIANTS.set(section.key, new Map());
  }
  SECTION_VARIANTS.get(section.key)!.set(locale, section);
}

// ── Register all variants ──

// identity
register(identityEN, 'en');
register(identityZH, 'zh');

// current_time
register(currentTimeEN, 'en');
register(currentTimeZH, 'zh');

// date_rules (semantic — must match locale)
register(dateRulesEN, 'en');
register(dateRulesZH, 'zh');

// web_search
register(webSearchEN, 'en');
register(webSearchZH, 'zh');

// general_rules (semantic — language rule must match locale)
register(generalRulesEN, 'en');
register(generalRulesZH, 'zh');

// formatting (language-agnostic, registered for both)
register(formatting, 'en');
register(formatting, 'zh');
