// ── JSON-RPC 2.0 types ──

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

// ── MCP Protocol types (Streamable HTTP, spec 2025-03-26) ──

export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities?: Record<string, any>;
  clientInfo?: { name: string; version: string };
}

export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools: {}; // server supports tools
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCallParams {
  name: string;
  arguments?: Record<string, any>;
}

export interface MCPToolCallContent {
  type: 'text';
  text: string;
}

export interface MCPToolCallResult {
  content: MCPToolCallContent[];
  isError: boolean;
}

export interface MCPListToolsResult {
  tools: MCPToolDefinition[];
}

// ── Session ──

export interface MCPSession {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastAccessAt: number;
}

// ── JSON-RPC error codes ──

export const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
