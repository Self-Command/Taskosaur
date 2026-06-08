import { Injectable, Logger } from '@nestjs/common';
import { MCPSession } from './types';
import * as crypto from 'crypto';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class McpSessionService {
  private readonly logger = new Logger(McpSessionService.name);
  private sessions = new Map<string, MCPSession>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  create(userId: string): MCPSession {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const session: MCPSession = {
      sessionId,
      userId,
      createdAt: now,
      lastAccessAt: now,
    };
    this.sessions.set(sessionId, session);
    this.logger.log(`Session created: ${sessionId} (userId=${userId})`);
    return session;
  }

  get(sessionId: string): MCPSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (Date.now() - session.lastAccessAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    session.lastAccessAt = Date.now();
    return session;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.logger.log(`Cleaned up ${removed} expired sessions`);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
