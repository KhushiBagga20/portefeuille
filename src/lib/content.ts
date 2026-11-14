// ─────────────────────────────────────────────
// The content layer.
//
// Every page asks for its content through the functions in this file — never by importing
// a data file directly. Today each function reads local data; when the "living portfolio"
// backend exists, swap the body of a function for a `fetch()` and nothing else changes.
// That is also why they are all `async` and return plain, JSON-shaped objects.
//
// Drafts (`status: 'draft'`) are shown while developing (`npm run dev`) and left out of
// the built site.
// ─────────────────────────────────────────────
import { playlist } from '../data/music';
import type { RoomId } from '../data/playground';

/** drafts are visible in development only */
export const showDrafts = import.meta.env.DEV;
export const isLive = <T extends { status?: 'draft' | 'published' }>(item: T) => showDrafts || item.status !== 'draft';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** the one-line stock count each room shows on its door */
export async function roomNotes(): Promise<Record<RoomId, string>> {
  return {
    lab: plural(1, 'experiment'),
    art: '',
    writing: '',
    records: plural(playlist.tracks.length, 'track'),
    films: '',
  };
}
