/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PIGA STUDIO — Vercel Serverless Entry Point (api/index.ts)
 * Mounts the shared Express application factory (src/server/app.ts).
 * Vercel routes every /api/* request here (see vercel.json); the SPA is
 * served from ./dist on the edge. No listen, no signal handlers: each warm
 * container keeps its Neon pool; cold boots run idempotent migrations once.
 */

import { createPigaApp } from '../src/server/app.ts';

type ExpressLike = (req: unknown, res: unknown) => void;

let appPromise: Promise<ExpressLike> | null = null;

export default async function handler(req: unknown, res: unknown): Promise<void> {
  if (!appPromise) {
    appPromise = createPigaApp() as unknown as Promise<ExpressLike>;
  }
  const app = await appPromise;
  app(req, res);
}
