import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  maxConnections: number;
}

export interface QueryResult<T> {
  data: T;
  durationMs: number;
  fromCache: boolean;
}

const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 20);
const POOL_MIN = Number(process.env.DB_POOL_MIN ?? 2);

let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: { url: process.env.DATABASE_URL },
      },
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    prismaInstance.$on('warn' as never, (e: unknown) => {
      logger.warn({ event: e }, 'Prisma warning');
    });

    prismaInstance.$on('error' as never, (e: unknown) => {
      logger.error({ event: e }, 'Prisma error');
    });
  }
  return prismaInstance;
}

export class DbScalingService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = getPrismaClient();
  }

  async getPoolStats(): Promise<PoolStats> {
    const result = await this.prisma.$queryRaw<
      Array<{ active: bigint; idle: bigint; waiting: bigint }>
    >`
      SELECT
        count(*) FILTER (WHERE state = 'active')  AS active,
        count(*) FILTER (WHERE state = 'idle')    AS idle,
        count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const row = result[0] ?? { active: 0n, idle: 0n, waiting: 0n };
    return {
      activeConnections: Number(row.active),
      idleConnections: Number(row.idle),
      waitingRequests: Number(row.waiting),
      maxConnections: POOL_MAX,
    };
  }

  async runHealthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      logger.error({ err }, 'DB health check failed');
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async getSlowQueries(
    thresholdMs = 1000,
    limit = 20,
  ): Promise<Array<{ query: string; calls: number; avgMs: number; totalMs: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ query: string; calls: bigint; mean_exec_time: number; total_exec_time: number }>
    >`
      SELECT query, calls, mean_exec_time, total_exec_time
      FROM pg_stat_statements
      WHERE mean_exec_time > ${thresholdMs}
        AND query NOT LIKE '%pg_stat%'
      ORDER BY mean_exec_time DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      query: r.query,
      calls: Number(r.calls),
      avgMs: Math.round(r.mean_exec_time),
      totalMs: Math.round(r.total_exec_time),
    }));
  }

  async getIndexUsage(): Promise<
    Array<{ table: string; index: string; scans: number; tuplesRead: number }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{
        relname: string;
        indexrelname: string;
        idx_scan: bigint;
        idx_tup_read: bigint;
      }>
    >`
      SELECT relname, indexrelname, idx_scan, idx_tup_read
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 50
    `;

    return rows.map((r) => ({
      table: r.relname,
      index: r.indexrelname,
      scans: Number(r.idx_scan),
      tuplesRead: Number(r.idx_tup_read),
    }));
  }

  getPoolConfig(): { min: number; max: number } {
    return { min: POOL_MIN, max: POOL_MAX };
  }
}
