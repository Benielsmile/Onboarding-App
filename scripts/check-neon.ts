/**
 * Vérificateur de santé NeonDB : connexion, tables, état métier.
 * Usage: npm run db:check
 */
import { Pool } from 'pg';
import 'dotenv/config';

async function main(): Promise<void> {
  const t0 = Date.now();
  const p = new Pool({
    connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const r = await p.query<{ n: number }>('SELECT count(*)::int AS n FROM public.participants');
    console.log(`NEON OK en ${Date.now() - t0} ms | participants en base: ${r.rows[0].n}`);

    const f = await p.query<{ id: string; is_active: boolean }>('SELECT id, is_active FROM public.formations ORDER BY is_active DESC');
    console.log('Formations:', f.rows.map(x => `${x.id}${x.is_active ? ' [ACTIVE]' : ''}`).join(', '));

    const a = await p.query<{ c: number; p: number }>(
      `SELECT count(*) FILTER (WHERE status='CONFIRMED')::int AS c, count(*) FILTER (WHERE status='PENDING')::int AS p FROM public.participants`
    );
    console.log(`Inventaire: confirmées=${a.rows[0].c} en_attente=${a.rows[0].p}`);

    const m = await p.query<{ version: string }>('SELECT version FROM public.schema_migrations ORDER BY version');
    console.log(`Migrations appliquées: ${m.rows.map((x: { version: string }) => x.version).join(', ')}`);
    console.log('✅ Connexion Neon opérationnelle.');
  } finally {
    await p.end();
  }
}

main().catch(err => {
  console.error('❌ Neon injoignable:', err instanceof Error ? err.message : err);
  process.exit(1);
});
