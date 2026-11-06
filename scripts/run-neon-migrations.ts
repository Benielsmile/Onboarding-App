/**
 * Exécuteur de migrations NeonDB versionnées (neon/migrations/*.sql).
 * Utilise la connexion DIRECTE (DATABASE_URL) comme recommandé par Neon
 * pour les opérations DDL, avec repli automatique sur la string poolée.
 * Usage: npm run db:migrate
 */
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'neon', 'migrations');

async function main(): Promise<void> {
  const p = new Pool({
    // DDL direct recommandé ; repli poolé si absente
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_URL_POOLED,
    connectionTimeoutMillis: 15_000,
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
      const client = await p.connect();
      try {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ [MIGRATION] ${file} appliquée.`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`❌ [MIGRATION FAILED] ${file}:`, err instanceof Error ? err.message : err);
        process.exitCode = 1;
        break;
      } finally {
        client.release();
      }
    }
  } finally {
    await p.end();
  }
}

main().catch(err => {
  console.error('❌ Moyen d\'accès Neon impossible:', err instanceof Error ? err.message : err);
  process.exit(1);
});
