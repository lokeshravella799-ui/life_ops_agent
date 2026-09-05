type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((item) => this.sanitize(item));

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = [
      'password',
      'secret',
      'token',
      'authorization',
      'card',
      'cvv',
      'pin',
      'upi',
      'apikey',
      'api_key',
    ];

    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? this.sanitize(meta) : undefined;
    const logObj = {
      timestamp,
      level,
      message,
      ...(cleanMeta ? { data: cleanMeta } : {}),
    };

    if (level === 'error') {
      console.error(`[LIFEOPS] [${timestamp}] [ERROR] ${message}`, cleanMeta ? JSON.stringify(cleanMeta) : '');
    } else if (level === 'warn') {
      console.warn(`[LIFEOPS] [${timestamp}] [WARN] ${message}`, cleanMeta ? JSON.stringify(cleanMeta) : '');
    } else {
      console.log(`[LIFEOPS] [${timestamp}] [${level.toUpperCase()}] ${message}`, cleanMeta ? JSON.stringify(cleanMeta) : '');
    }
  }

  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, meta);
    }
  }
}

export const logger = new Logger();
