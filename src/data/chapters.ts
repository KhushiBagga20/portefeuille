// ─────────────────────────────────────────────
// The running order of the home page.
// Every section's index number — (03), (07)… — is its position in this list, so adding,
// removing or reordering a section renumbers the whole site by itself.
// ─────────────────────────────────────────────
export const chapters = [
  { id: 'top', name: 'cover' },
  { id: 'cube', name: 'fidget' },
  { id: 'keyboard', name: 'navigate' },
  { id: 'about', name: 'about' },
  { id: 'projects', name: 'work' },
  { id: 'milestones', name: 'milestones' },
  { id: 'experience', name: 'beyond' },
  { id: 'skills', name: 'tools' },
  { id: 'resume', name: 'résumé' },
  { id: 'records', name: 'records' },
  { id: 'contact', name: 'contact' },
] as const;

export type ChapterId = (typeof chapters)[number]['id'];

/** "03" for the fourth section, and the attributes the nav and the jump card read. */
export function chapter(id: ChapterId) {
  const i = chapters.findIndex((c) => c.id === id);
  const index = String(i).padStart(2, '0');
  return { index, name: chapters[i].name, attrs: { 'data-chapter': index, 'data-chapter-name': chapters[i].name } };
}
