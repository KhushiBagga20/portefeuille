import type { CaseStudy } from '../../lib/types';

// Four projects whose write-ups are still thin. Each records only what is confirmed;
// the page lists everything else under "still to come".

export const mindPop: CaseStudy = {
  slug: 'mind-pop',
  status: 'published',
  intro: { built: ['An AI study tool, designed in a neo-brutalist style.'] },
  timeline: [
    {
      title: 'HackNWin Hackathon',
      date: '2025',
      stage: 'done',
      kind: 'recognition',
      items: ['Selected in the top 15 teams out of approximately 400', 'Received a shoutout from GDG Jalandhar'],
    },
  ],
};

export const kinetic: CaseStudy = {
  slug: 'kinetic',
  status: 'published',
  intro: {},
  timeline: [{ title: 'Agentic AI hackathon', stage: 'done', kind: 'recognition', items: ['₹6000 prize'] }],
};

export const verifai: CaseStudy = {
  slug: 'verifai',
  status: 'published',
  intro: {
    built: [
      'VerifAI is an AI system focused on identifying and analysing bias in decision-making systems, such as job applications, loan applications and similar decisions.',
    ],
  },
  timeline: [{ title: 'Hack Helix 6.0', stage: 'done', items: ['Competed among approximately 100 teams at Hack Helix 6.0, Thapar'] }],
};

export const kineticCity: CaseStudy = {
  slug: 'kinetic-city',
  status: 'published',
  intro: {},
};
