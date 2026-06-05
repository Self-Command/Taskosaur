export interface PromptContext {
  timezone: string;
  locale: string;
  dateLocale: string;
  dateStr: string;
  offsetStr: string;
}

export interface PromptSection {
  key: string;
  render: (ctx: PromptContext) => string;
}
