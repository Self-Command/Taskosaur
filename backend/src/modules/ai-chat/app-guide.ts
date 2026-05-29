// DEPRECATED: Browser automation app guide has been replaced by MCP tool-calling system.
// See ../mcp-tools/prompts.ts for the new system prompt.

export function getUrlContext(_url: string) {
  return { workspace: null, project: null, page: 'other' as const };
}

export function enhancePromptWithContext(_userRequest: string, _currentUrl: string): string {
  return '';
}

export function getCurrentPageContext(_url: string): string {
  return '';
}

export function getWorkflowGuide(_taskType: string): string {
  return '';
}
