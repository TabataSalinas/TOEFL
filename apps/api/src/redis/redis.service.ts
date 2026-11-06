import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Thin Redis wrapper. Used for caching generated question banks and
 * short-lived exam-session state. Degrades gracefully if Redis is unavailable.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client?: Redis;
  private available = false;

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL not set — cache disabled.');
      return;
    }
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    this.client
      .connect()
      .then(() => {
        this.available = true;
        this.logger.log('Connected to Redis.');
      })
      .catch((err) => {
        this.available = false;
        this.logger.warn(`Redis unavailable, continuing without cache: ${err.message}`);
      });
    this.client.on('error', () => {
      this.available = false;
    });
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.available || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds) await this.client.set(key, raw, 'EX', ttlSeconds);
      else await this.client.set(key, raw);
    } catch {
      /* ignore cache failures */
    }
  }

  async del(key: string): Promise<void> {
    if (!this.available || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      /* ignore */
    }
  }
}
