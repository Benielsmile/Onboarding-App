/**
 * Nettoyage one-shot des données de test injectées pendant l'intégration Neon.
 * Supprime: participants de test (+ leurs logs d'audit) et images de test.
 * Usage: npx tsx scripts/cleanup-test-data.ts
 */
import { Pool } from 'pg';
import 'dotenv/config';

async function main(): Promise<void> {
  const p = new Pool({
    connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const emails = ['durable.om@example.cd', 'persist.neon@example.cd', 'test.neon@example.cd'];
    for (const email of emails) {
      const found = await p.query<{ id: string; proof: string | null }>(
        'SELECT id, proof_storage_path AS proof FROM public.participants WHERE lower(email) = $1',
        [email]
      );
      for (const row of found.rows) {
        await p.query('DELETE FROM public.audit_logs WHERE participant_id = $1', [row.id]);
        if (row.proof && row.proof !== 'proofs/pending_upload.jpg') {
          await p.query('DELETE FROM public.stored_files WHERE path = $1', [row.proof]);
        }
        await p.query('DELETE FROM public.participants WHERE id = $1', [row.id]);
        console.log(`^{-} Supprimé participant de test: ${email} (${row.id})`);
      }
    }

    // Images d'upload de test
    const imgs = await p.query<{ path: string }>(
      "SELECT path FROM public.stored_files WHERE path LIKE 'uploads/img-%' AND created_at > now() - interval '1 day'"
    );
    for (const row of imgs.rows) {
      await p.query('DELETE FROM public.stored_files WHERE path = $1', [row.path]);
      console.log(`Supprimé fichier de test: ${row.path}`);
    }

    // Journal d'audit : purge les tentatives de test sans participant
    await p.query(
      `DELETE FROM public.audit_logs
        WHERE admin_id = 'SYSTEM_GATEWAY'
          AND metadata->>'note' = 'Initial participant registration created'
          AND participant_id IS NULL`
    );

    const left = await p.query<{ n: number }>('SELECT count(*)::int AS n FROM public.participants');
    console.log(`Participants restants en base: ${left.rows[0].n}`);
    console.log('✅ Nettoyage terminé.');
  } finally {
    await p.end();
  }
}

main().catch(err => {
  console.error('❌ Nettoyage impossible:', err instanceof Error ? err.message : err);
  process.exit(1);
});
