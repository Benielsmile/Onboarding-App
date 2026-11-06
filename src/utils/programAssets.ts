/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PIGA STUDIO — Bundled Formation Image Assets & URL Resolution
 * Ensures persisted legacy paths ("/src/assets/images/...") resolve in both
 * development (raw source path) and production (hashed bundled asset).
 * Never import this module from the Node server (Vite asset imports only).
 */

import heroFallbackImage from '../assets/images/hero_arsenal_agentique_1793949804735.jpg';
import auditoriumFallbackImage from '../assets/images/event_keynote_hall_1793949804529.jpg';

export const HERO_IMAGE_FALLBACK = heroFallbackImage;
export const AUDITORIUM_IMAGE_FALLBACK = auditoriumFallbackImage;

/** Legacy raw source paths mapped to their bundled production URLs */
const LEGACY_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/hero_arsenal_agentique_1793949804735.jpg': heroFallbackImage,
  '/src/assets/images/event_keynote_hall_1793949804529.jpg': auditoriumFallbackImage
};

/**
 * Resolves a configured image URL: legacy source paths are remapped to the
 * bundled asset, uploaded images ("/api/uploads/...") and absolute URLs pass
 * through untouched, and empty values fall back to the provided default.
 */
export function resolveFormationImageUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  return LEGACY_ASSET_MAP[url] || url;
}
