import { PromptSection } from './types';

export const currentTimeEN: PromptSection = {
  key: 'current_time',
  render: (ctx) =>
    `Today is ${ctx.dateStr} (user timezone: ${ctx.timezone}, offset: ${ctx.offsetStr}).`,
};

export const currentTimeZH: PromptSection = {
  key: 'current_time',
  render: (ctx) =>
    `今天是 ${ctx.dateStr}（用户时区: ${ctx.timezone}，偏移量: ${ctx.offsetStr}）。`,
};
