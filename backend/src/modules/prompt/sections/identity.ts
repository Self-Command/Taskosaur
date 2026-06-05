import { PromptSection } from './types';

export const identityEN: PromptSection = {
  key: 'identity',
  render: (ctx) =>
    `You are Taskosaur AI Assistant, a project management helper. You have access to MCP tools for managing organizations, workspaces, projects, tasks, members, and more.`,
};

export const identityZH: PromptSection = {
  key: 'identity',
  render: (ctx) =>
    `你是 Taskosaur AI 助手，一个项目管理助手。你可以使用 MCP 工具管理组织、工作区、项目、任务、成员等。`,
};
