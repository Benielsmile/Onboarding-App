/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Arsenal Agentique 2026 — LOCAL DEVELOPMENT LAUNCHER
 * Wraps the shared application factory (src/server/app.ts) with:
 * - Vite HMR middleware for hot client development
 * - Crash sentinels, graceful shutdown & heartbeat (long-lived process only)
 * 
 * On Vercel, the SAME factory is mounted serverlessly by api/index.ts —
 * no listen, no signal handlers, state 100% on NeonDB.
 */

import 'dotenv/config';
import type { Server } from 'node:http';
import { createPigaApp } from './src/server/app.ts';
import { closeNeon } from './src/server/neonStore.ts';

const PORT = Number(process.env.PORT) || 3000;

async function main(): Promise<void> {
  const app = await createPigaApp({ devVite: true });

  // Crash sentinels: log every fatal condition with a timestamp instead of
  // dying silently (Neon idle disconnects, Vite HMR restarts, unhandled I/O…).
  process.on('uncaughtException', (err) => {
    console.error(`[UNCAUGHT EXCEPTION ${new Date().toISOString()}]:`, err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(`[UNHANDLED REJECTION ${new Date().toISOString()}]:`, reason);
  });
  setInterval(() => {
    console.log(`[HEARTBEAT ${new Date().toISOString()}] uptime=${Math.round(process.uptime())}s heap=${(process.memoryUsage().heapUsed / 1048576).toFixed(0)}Mo`);
  }, 300_000).unref();

  let server: Server | null = null;
  const shutdown = async (signal: string) => {
    console.log(`[${signal}] Arrêt gracieux : libération du pool Neon...`);
    await closeNeon();
    server?.closeAllConnections?.();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ARSENAL AGENTIQUE] Full-stack engine running at http://0.0.0.0:${PORT}`);
    console.log('[STATELESS] État 100% sur NeonDB : participants, formations, audit, fichiers, sessions admin.');
  });
}

main().catch((err) => {
  console.error('[FATAL SERVER INITIALIZATION FAILED]:', err);
  process.exit(1);
});
