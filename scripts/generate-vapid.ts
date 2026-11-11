/**
 * Générateur de clés VAPID (notifications push serveur W3C).
 * Usage: npm run generate:vapid
 * Copiez les lignes affichées dans .env (local) ET dans Vercel Project Settings.
 */
import * as webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\n🔑 Clés VAPID générées — ajoutez-les aux variables d\'environnement :\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:direction@piga.cd`);
console.log('\n⚠️  Conservez ces clés : la clé PUBLIQUE est servie au navigateur,');
console.log('   la PRIVÉE ne doit jamais quitter le serveur (.env / Vercel).\n');
