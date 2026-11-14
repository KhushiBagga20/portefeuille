// ─────────────────────────────────────────────
// Case studies, one per project, keyed by the project's slug.
//
// To add one: create <slug>.ts next to this file exporting a `CaseStudy` (the shape, with
// every field explained, is in src/lib/types.ts), then add it to the list below. The page
// at /projects/<slug>/ builds itself from whichever sections you filled in.
// ─────────────────────────────────────────────
import type { CaseStudy } from '../../lib/types';
import { conduit } from './conduit';
import { kinetic, kineticCity, mindPop, verifai } from './others';
import { sahaas } from './sahaas';

export const caseStudies: CaseStudy[] = [conduit, sahaas, mindPop, kinetic, verifai, kineticCity];
