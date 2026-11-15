// ─────────────────────────────────────────────
// Content collections: long-form writing lives in Markdown files, one piece per file.
//
// The Writing Room (/playground/writing/) reads every .md file in src/content/writing/.
// The lines between the --- marks at the top of a file are checked against the schema
// below, so a typo in a kind or a date is caught when the site builds.
// ─────────────────────────────────────────────
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    /** which shelf of the archive it sits on, and how it is set on the page */
    kind: z.enum(['poem', 'essay', 'fiction']),
    /** which half of the room it belongs to: personal (poems and the like) or professional */
    side: z.enum(['personal', 'professional']).default('personal'),
    /** where it was first published, if anywhere: a full address */
    source: z.url().optional(),
    /** when it was written or finished. Leave out if you'd rather not say. */
    date: z.coerce.date().optional(),
    /** one line under the title */
    dek: z.string().optional(),
    /** the lines shown in the archive. Taken from the opening of the piece if left out. */
    excerpt: z.string().optional(),
    /** 'draft' keeps a piece off the built site; it still shows in `npm run dev` */
    status: z.enum(['draft', 'published']).default('published'),
    /** only the stand-ins that ship with the site set this */
    sample: z.boolean().default(false),
  }),
});

export const collections = { writing };
