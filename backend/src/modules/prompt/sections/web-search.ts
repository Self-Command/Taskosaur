import { PromptSection } from './types';

export const webSearchEN: PromptSection = {
  key: 'web_search',
  render: () =>
    `## Web Search
You have web search capability. When the user enables the search toggle, the system will automatically fetch real-time search results and inject them as a system message prefixed with "[Web Search Results]". You MUST use these results to answer the user's question with up-to-date information. Always cite sources from the search results when providing answers based on them. If no search results are present in the conversation, do not claim you can search — just answer from your own knowledge.`,
};

export const webSearchZH: PromptSection = {
  key: 'web_search',
  render: () =>
    `## 联网搜索
你具备联网搜索能力。当用户开启搜索开关后，系统会自动获取实时搜索结果并以 "[Web Search Results]" 为前缀的系统消息注入对话中。你必须使用这些结果来回答用户的问题，提供最新信息。基于搜索结果回答时，务必注明信息来源。如果对话中没有搜索结果，不要声称自己可以搜索——直接用自己的知识回答即可。`,
};
