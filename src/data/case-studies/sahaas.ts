import type { CaseStudy } from '../../lib/types';

const CAVEAT = 'Ongoing project: these are the ideas it is being built around, and not all of them are live yet.';

export const sahaas: CaseStudy = {
  slug: 'sahaas',
  status: 'published',

  intro: {
    problem: [
      'People affected by atrocities often go through prolonged legal and social difficulties. Sahaas focuses on continuous support through that time, not only a one-time report.',
    ],
  },

  features: [
    {
      title: 'What it is designed to do',
      stage: 'ongoing',
      note: CAVEAT,
      items: [
        'Multi-channel access: web reporting, IVRS / helpline, and SMS, chatbot, mobile or web interfaces where applicable',
        'Early signal identification',
        'Distress and support-pattern analysis',
        'Routing people toward counselling, legal aid, compensation and protection',
        'Trauma-informed interaction design',
        'Continuous support rather than one-time reporting',
      ],
    },
  ],

  diagrams: [
    {
      id: 'flow',
      title: 'The intended flow',
      basis: 'designed',
      caption: `From first contact to the right kind of help. ${CAVEAT}`,
      nodes: [
        {
          id: 'person',
          label: 'Someone who needs support',
          kind: 'person',
          col: 0,
          row: 1.5,
          summary: 'A person affected by an atrocity, often through a long legal and social process.',
          details: ['The design centres on staying with them over time, not on a single report'],
        },
        { id: 'web', label: 'Web reporting', kind: 'channel', col: 1, row: 0.5, summary: 'One of the ways in.', stage: 'ongoing' },
        { id: 'ivrs', label: 'IVRS / helpline', kind: 'channel', col: 1, row: 1.5, summary: 'A helpline, as another of the ways in.', tech: ['IVRS'], stage: 'ongoing' },
        {
          id: 'other',
          label: 'SMS, chatbot, mobile',
          kind: 'channel',
          col: 1,
          row: 2.5,
          summary: 'SMS, chatbot, mobile or web interfaces where applicable.',
          stage: 'ongoing',
        },
        {
          id: 'signals',
          label: 'Early signal identification',
          kind: 'step',
          col: 2,
          row: 1,
          summary: 'Noticing early signs of distress.',
          stage: 'ongoing',
        },
        {
          id: 'patterns',
          label: 'Distress & support-pattern analysis',
          kind: 'step',
          col: 2,
          row: 2,
          summary: 'Distress and support-pattern analysis.',
          stage: 'ongoing',
        },
        {
          id: 'routing',
          label: 'Routing',
          kind: 'service',
          col: 3,
          row: 1.5,
          summary: 'Routing people toward counselling, legal aid, compensation and protection.',
          details: ['Trauma-informed interaction design'],
          stage: 'ongoing',
        },
        { id: 'counselling', label: 'Counselling', kind: 'outcome', col: 4, row: 0, stage: 'ongoing' },
        { id: 'legal', label: 'Legal aid', kind: 'outcome', col: 4, row: 1, stage: 'ongoing' },
        { id: 'compensation', label: 'Compensation', kind: 'outcome', col: 4, row: 2, stage: 'ongoing' },
        { id: 'protection', label: 'Protection', kind: 'outcome', col: 4, row: 3, stage: 'ongoing' },
      ],
      edges: [
        { from: 'person', to: 'web', flow: 'forward' },
        { from: 'person', to: 'ivrs', flow: 'forward' },
        { from: 'person', to: 'other', flow: 'forward' },
        { from: 'web', to: 'signals', flow: 'forward' },
        { from: 'ivrs', to: 'signals', flow: 'forward' },
        { from: 'other', to: 'signals', flow: 'forward' },
        { from: 'web', to: 'patterns', flow: 'forward' },
        { from: 'ivrs', to: 'patterns', flow: 'forward' },
        { from: 'other', to: 'patterns', flow: 'forward' },
        { from: 'signals', to: 'routing', flow: 'forward' },
        { from: 'patterns', to: 'routing', flow: 'forward' },
        { from: 'routing', to: 'counselling', flow: 'forward' },
        { from: 'routing', to: 'legal', flow: 'forward' },
        { from: 'routing', to: 'compensation', flow: 'forward' },
        { from: 'routing', to: 'protection', flow: 'forward' },
      ],
    },
  ],

  mindmap: {
    idea: [
      {
        label: 'Continuous support, not a one-time report',
        note: 'People affected by atrocities often go through prolonged legal and social difficulties. Sahaas focuses on continuous support through that time.',
      },
      { label: 'Crowdsourced civic and mental-health support' },
    ],
    implementation: [
      {
        label: 'Ways in',
        stage: 'ongoing',
        children: [{ label: 'Web reporting' }, { label: 'IVRS / helpline' }, { label: 'SMS, chatbot, mobile or web' }],
      },
      {
        label: 'Noticing',
        stage: 'ongoing',
        children: [{ label: 'Early signal identification' }, { label: 'Distress and support-pattern analysis' }],
      },
      {
        label: 'Routing toward',
        stage: 'ongoing',
        children: [{ label: 'Counselling' }, { label: 'Legal aid' }, { label: 'Compensation' }, { label: 'Protection' }],
      },
      { label: 'Trauma-informed interaction design', stage: 'ongoing' },
    ],
  },

  timeline: [{ title: 'Smart India Hackathon', stage: 'ongoing', body: 'Ongoing, connected to the Smart India Hackathon.' }],
};
