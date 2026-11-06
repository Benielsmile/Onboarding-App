/**
 * Contrôle d'intégrité des tickets cryptographiques avec la clé actuelle.
 * Vérifie que chaque participant CONFIRMED a un cryptoToken déchiffrable
 * avec ARSENAL_SECRET courant.
 * Usage: npx tsx scripts/check-tickets.ts
 */
import { Pool } from 'pg';
import 'dotenv/config';
import { decryptAES256GCM } from '../src/server/neonStore.ts';

async function main(): Promise<void> {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const rows = await p.query<{ full_name: string; ticket_code: string | null; crypto_token: string | null }>(
      `SELECT full_name, ticket_code, crypto_token FROM public.participants WHERE crypto_token IS NOT NULL`
    );
    if (rows.rows.length === 0) { console.log('Aucun ticket émis. Rien à vérifier.'); return; }
    let valid = 0, invalid = 0;
    for (const r of rows.rows) {
      const res = decryptAES256GCM(r.crypto_token as string);
      if (res.isValid) { valid++; console.log(`✅ ${r.full_name} (${r.ticket_code})`); }
      else { invalid++; console.log(`❌ ${r.full_name} (${r.ticket_code}) — ${res.error}`); }
    }
    console.log(invalid === 0
      ? `✅ ARSENAL_SECRET conforme : ${valid} ticket(s) vérifié(s), aucun invalide.`
      : `⚠️ ${invalid} ticket(s) invalide(s) : la clé a changé. Re-confirmer via le portail admin pour regénérer les billets.`);
  } finally {
    await p.end();
  }
}

main().catch(err => { console.error('❌', err instanceof Error ? err.message : err); process.exit(1); });
