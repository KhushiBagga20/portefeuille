// ─────────────────────────────────────────────
// The running order of the main portfolio — "what I've built".
// Every section's index number — (03), (07)… — is its position in this list, so adding,
// removing or reordering a section renumbers the whole page by itself.
//
// The Playground ("how my brain works") is a separate set of pages with its own order:
// see src/data/playground.ts.
// ─────────────────────────────────────────────
export const chapters = [
  { id: 'top', name: 'cover' },
  { id: 'keyboard', name: 'navigate' },
  { id: 'projects', name: 'projects' },
  { id: 'about', name: 'about' },
  { id: 'experience', name: 'experience' },
  { id: 'milestones', name: 'milestones' },
  { id: 'skills', name: 'skills' },
  { id: 'resume', name: 'résumé' },
  { id: 'contact', name: 'contact' },
] as const;

export type ChapterId = (typeof chapters)[number]['id'];

/** "03" for the fourth section, and the attributes the nav and the jump card read. */
export function chapter(id: ChapterId) {
  const i = chapters.findIndex((c) => c.id === id);
  const index = String(i).padStart(2, '0');
  return { index, name: chapters[i].name, attrs: { 'data-chapter': index, 'data-chapter-name': chapters[i].name } };
}
