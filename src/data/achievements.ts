// ─────────────────────────────────────────────
// Milestones: hackathons, recognition and workshops.
// Keep wording to what actually happened. `project` links to a case study when it has a slug.
// ─────────────────────────────────────────────
import type { Label } from './projects';

export type Achievement = {
  event: string;
  /** what the index tab says: the event's name, shortened. Nothing new. */
  tab: string;
  where?: string;
  year?: string;
  project: { name: string; slug?: string };
  highlights: string[];
  labels: Label[];
  todo?: string[];
};

export const achievements: Achievement[] = [
  {
    event: 'HackNWin Hackathon',
    tab: 'HackNWin',
    where: 'CGC',
    year: '2025',
    project: { name: 'Mind Pop', slug: 'mind-pop' },
    highlights: ['Top 15 of ~400 teams', 'Shoutout from GDG Jalandhar'],
    labels: ['Hackathon', 'Recognition', 'AI'],
  },
  {
    event: 'Agentic AI hackathon',
    tab: 'Agentic AI',
    project: { name: 'Kinetic', slug: 'kinetic' },
    highlights: ['₹6000 prize'],
    labels: ['Hackathon', 'Recognition', 'AI'],
    todo: ['Exact event name', 'Year'],
  },
  {
    event: 'Hack Helix 6.0',
    tab: 'Hack Helix',
    where: 'Thapar',
    project: { name: 'VerifAI', slug: 'verifai' },
    highlights: ['Competed among ~100 teams'],
    labels: ['Hackathon', 'AI'],
    todo: ['Final result', 'Year'],
  },
  {
    event: 'Smart India Hackathon',
    tab: 'Smart India',
    project: { name: 'Sahaas', slug: 'sahaas' },
    highlights: ['Ongoing project'],
    labels: ['Hackathon', 'Ongoing', 'Social impact'],
    todo: ['Stage / result', 'Year'],
  },
  {
    event: 'Vibe to Viable workshop',
    tab: 'Vibe to Viable',
    project: { name: 'AI study app' },
    highlights: ['Built an AI study app'],
    labels: ['Workshop', 'AI'],
    todo: ['Year', 'App name'],
  },
];
