/**
 * Exécuteur de migrations NeonDB — variante WEBSOCKET (port 443).
 * À utiliser lorsque le réseau local bloque le Postgres TCP port 5432
 * (DNS filtré / DPI / VPN) : cette variante passe par wss:// aussi autorisé
 * que le HTTPS classique.
 * Usage: npm run db:migrate:ws
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

// Node >= 22 expose nativement l'API WebSocket (undici) — aucune dépendance 'ws'
if (typeof globalThis.WebSocket === 'undefined') {
  console.error('❌ WebSocket natif indisponible : exigez Node >= 22 pour ce script.');
  process.exit(1);
}
neonConfig.webSocketConstructor = globalThis.WebSocket as never;
neonConfig.useSecureWebSocket = true;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'neon', 'migrations');

async function main(): Promise<void> {
  const p = new Pool({
    // Le pooler Neon expose wss:// sur 443 ; repli direct si besoin
    connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
    connectionTimeoutMillis: 30_000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await p.query(
      `CREATE TABLE IF NOT EXISTS public.schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
       )`
    );

    const appliedRows = await p.query<{ version: string }>('SELECT version FROM public.schema_migrations');
    const applied = new Set(appliedRows.rows.map(r => r.version));

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log(`✅ Aucune migration en attente (${files.length} déjà appliquée(s)).`);
      return;
    }

    for (const file of pending) {
      try {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await p.query(sql);
        await p.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [file]);
        console.log(`✅ [MIGRATION WS] ${file} appliquée.`);
      } catch (err) {
        console.error(`❌ [MIGRATION WS FAILED] ${file}:`, err instanceof Error ? err.message : err);
        process.exitCode = 1;
        break;
      }
    }
  } finally {
    await p.end();
  }
}

main().catch(err => {
  console.error('❌ Neon (WS 443) injoignable:', err instanceof Error ? err.message : err);
  process.exit(1);
});
