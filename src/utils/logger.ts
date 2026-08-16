import { randomUUID } from 'crypto';
import { supabase } from '../database/client';

type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  action?: string;
  actor?: string;
  resource?: string;
  duration_ms?: number;
  message?: string;
  metadata?: any;
}

export class Logger {
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || randomUUID();
  }

  getRequestId() {
    return this.requestId;
  }

  private sanitize(data: any): any {
    if (!data) return data;
    if (typeof data === 'string') {
      // Basic redaction (not foolproof, but handles obvious cases)
      return data.replace(/(token|secret|key|password)=[^&]*/gi, '$1=***');
    }
    if (typeof data === 'object') {
      const sanitized = { ...data };
      const sensitiveKeys = ['token', 'secret', 'password', 'key', 'bot_token'];
      for (const k of Object.keys(sanitized)) {
        if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
          sanitized[k] = '***';
        } else if (typeof sanitized[k] === 'object') {
          sanitized[k] = this.sanitize(sanitized[k]);
        }
      }
      return sanitized;
    }
    return data;
  }

  private async writeLog(level: LogLevel, payload: LogPayload) {
    const sanitizedMetadata = this.sanitize(payload.metadata) || {};
    const logEntry = {
      level,
      request_id: this.requestId,
      action: payload.action,
      actor: payload.actor,
      resource: payload.resource,
      duration_ms: payload.duration_ms,
      message: payload.message,
      metadata: sanitizedMetadata
    };

    // Console output for Vercel Logs
    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }

    // Persist to DB for Admin Dashboard visibility
    // We wrap in try/catch so logging doesn't crash the app
    try {
      await supabase.from('system_logs').insert([logEntry]);
    } catch (e) {
      console.error('Failed to write log to DB', e);
    }
  }

  info(payload: LogPayload) {
    return this.writeLog('info', payload);
  }

  warn(payload: LogPayload) {
    return this.writeLog('warn', payload);
  }

  error(payload: LogPayload) {
    return this.writeLog('error', payload);
  }
}
