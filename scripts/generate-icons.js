/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIGA STUDIO — Pont multi-plateforme vers le générateur d'icônes.
 * Le rendu réel du set (favicon 32/96, apple-touch 180, PWA 192/512,
 * maskable 512) est assuré par scripts/generate-icons.ps1 (System.Drawing),
 * à partir du logo officiel : src/assets/icon/PIGA LOGO SYMBOL.png
 *
 * Ancienne version : générait un motif pixelisé générique qui ÉCRASAIT le
 * logo officiel → remplacée par ce délégation pour éviter tout retour arrière.
 *
 * Usage: node scripts/generate-icons.js
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

try {
  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', path.join(here, 'generate-icons.ps1')
  ], { stdio: 'inherit' });
} catch (err) {
  console.error('[ICONES] Génération impossible via PowerShell (System.Drawing, Windows).');
  console.error('[ICONES] Sur un autre OS, regeneratez les PNG une fois puis commitez-les.');
  process.exitCode = 1;
}
