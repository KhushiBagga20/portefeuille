// ─────────────────────────────────────────────
// Projects: the card-level facts — what the index, the floppy disks, the skills graph and
// the top of each case study use. The case study itself (architecture, timeline, deep
// dives…) lives beside this file in src/data/case-studies/<slug>.ts.
//
// Pages never import this file directly: they ask src/lib/content.ts, so this data can be
// swapped for an API later without touching a component.
//
// House rules:
// - Only write what's confirmed. Leave a field out (or an item list empty) when you don't
//   know it yet: the site shows a styled "details coming soon" instead of guessing.
// - Links only appear once they're filled in.
// - `todo` is a note to yourself. It's never shown on the site.
// ─────────────────────────────────────────────

import type { ArchiveItem, DiskTone, Project } from '../lib/types';
export type { ArchiveItem, DiskTone, Label, Project } from '../lib/types';

/** Disk plastic, its shaded edge, the ink that reads on it, and `glow`: the same colour
 *  lifted far enough to read on a dark ground (the case studies' dark bands use it). */
export const diskTones: Record<DiskTone, { body: string; shade: string; on: string; glow: string }> = {
  tomato: { body: '#ff4d1f', shade: '#d83a10', on: '#0c0d21', glow: '#ff6a40' },
  pink: { body: '#ff2a85', shade: '#d81a6b', on: '#0c0d21', glow: '#ff4f9a' },
  lilac: { body: '#7a3cff', shade: '#5c22e0', on: '#ffffff', glow: '#b196ff' },
  lemon: { body: '#d6ff3d', shade: '#b2dc1a', on: '#0c0d21', glow: '#d6ff3d' },
  sky: { body: '#2238ff', shade: '#1426d4', on: '#ffffff', glow: '#8f9bff' },
  mint: { body: '#0c0d21', shade: '#000000', on: '#f3f3ef', glow: '#ffae00' },
};

export const projects: Project[] = [
  {
    slug: 'conduit',
    name: 'Conduit',
    earlierName: 'PUL',
    type: 'Personal project · native software',
    oneLiner: 'Wireless Android-to-Mac integration: mirror your phone, control it from your Mac, and use it as an input device.',
    preview:
      'Screen mirroring with hardware H.264 decoding, mouse, trackpad and keyboard control, two-way clipboard, phone audio on the Mac, and automatic reconnection.',
    labels: ['Personal project', 'Native software'],
    stack: ['Swift', 'SwiftUI', 'macOS', 'Android', 'VideoToolbox', 'H.264', 'AVFoundation', 'ADB', 'Socket programming'],
    disk: { tone: 'sky', scribble: 'conduit' },
    links: {},
    todo: [
      'Planned / future Conduit features',
      'What changed between PUL and Conduit',
      'Your role (e.g. solo build?)',
      'GitHub or demo link, screenshots or a video',
    ],
  },
  {
    slug: 'sahaas',
    name: 'Sahaas',
    type: 'Ongoing project',
    oneLiner:
      'A crowdsourced civic and mental-health support platform for people affected by atrocities and prolonged legal and social difficulties.',
    preview:
      'Built around continuous support rather than one-time reporting: reaching people across channels, noticing early signs of distress, and routing them toward counselling, legal aid, compensation and protection.',
    labels: ['Ongoing', 'Hackathon', 'Social impact', 'AI'],
    event: 'Smart India Hackathon',
    stack: ['React', 'FastAPI', 'Firebase', 'Supabase', 'LLMs', 'IVRS'],
    disk: { tone: 'pink', scribble: 'sahaas' },
    links: {},
    todo: ['Your role / contribution', 'What is built so far vs. planned', 'SIH stage or result', 'Links or screenshots'],
  },
  {
    slug: 'mind-pop',
    name: 'Mind Pop',
    type: 'Hackathon project',
    oneLiner: 'An AI study tool with a neo-brutalist design.',
    preview: 'Selected in the top 15 of roughly 400 teams at HackNWin 2025, with a shoutout from GDG Jalandhar.',
    labels: ['Hackathon', 'Recognition', 'AI', 'Product design'],
    event: 'HackNWin Hackathon · CGC · 2025',
    outcome: ['Top 15 of ~400 teams', 'Shoutout from GDG Jalandhar'],
    disk: { tone: 'lemon', scribble: 'mind pop' },
    links: {},
    todo: ['Feature list', 'Technologies', 'Your contribution', 'Links or screenshots'],
  },
  {
    slug: 'kinetic',
    name: 'Kinetic',
    type: 'Agentic AI hackathon project',
    labels: ['Hackathon', 'Recognition', 'AI'],
    outcome: ['₹6000 prize'],
    disk: { tone: 'lilac', scribble: 'kinetic' },
    links: {},
    todo: [
      'Exact hackathon name',
      'One-line description + short preview',
      'Features',
      'Technologies',
      'Your contribution',
      'What the ₹6000 prize was for (placement / track)',
      'Links or screenshots',
    ],
  },
  {
    slug: 'verifai',
    name: 'VerifAI',
    type: 'Hackathon project',
    oneLiner: 'An AI system for identifying and analysing bias in decision-making, such as job and loan applications.',
    labels: ['Hackathon', 'AI'],
    event: 'Hack Helix 6.0 · Thapar · ~100 teams',
    disk: { tone: 'mint', scribble: 'verifai' },
    links: {},
    todo: ['Final result', 'Features', 'Technologies', 'Your contribution', 'Links or screenshots'],
  },
  {
    slug: 'kinetic-city',
    name: 'Kinetic City',
    type: 'Hackathon project',
    labels: ['Hackathon'],
    event: 'Finvasia Hackathon',
    disk: { tone: 'tomato', scribble: 'kinetic city' },
    links: {},
    todo: ['Description / problem statement', 'Features', 'Technologies', 'Your contribution', 'Demo link', 'Outcome'],
  },
];

// ─────────────────────────────────────────────
// Archive: smaller things that shouldn't compete with the featured disks.
// ─────────────────────────────────────────────

export const archive: ArchiveItem[] = [
  {
    name: 'CommonGround',
    type: 'Community hobby platform',
    labels: ['Product design'],
    description: 'A platform designed to help people find communities and people who share their interests.',
    points: [
      'Hobby discovery, groups, mentors, workshops, chat and location exploration',
      'User research, responsive interface and design-system work',
    ],
    stack: ['React', 'JavaScript', 'UI/UX', 'Figma'],
    links: {},
  },
  {
    name: 'Student Support & Wellbeing AI Agent',
    type: 'Conversational AI assistant',
    labels: ['AI'],
    description: 'An assistant for students dealing with workload, deadlines and stress.',
    points: [
      'Focused on contextual prompting and responsible AI',
      'Considered privacy, context retention, emotional dependency and escalation boundaries',
    ],
    stack: ['AI agents', 'LLMs', 'Prompt engineering', 'Responsible AI'],
    links: {},
  },
  {
    name: 'Vibe to Viable study app',
    type: 'Workshop build',
    labels: ['Workshop', 'AI'],
    description: 'An AI study app made during the Vibe to Viable workshop.',
    links: {},
    todo: ['What it does', 'Technologies', 'Links'],
  },
];
