// ─────────────────────────────────────────────
// The résumé, as data.
//
// Everything here is taken from public/Khushi_Bagga_Resume.pdf — same facts, same wording.
// When the PDF changes, change this to match (and nothing else: the page builds itself).
//
// `depth` decides which reading length a line first appears in:
//   1  the skim          2  the proper read          3  everything
// `tags` are the lenses a line shows up under. Lines with no tags are never dimmed.
//
// Left out on purpose: phone number and home town. They're in the PDF for people who ask
// for it, and don't need to sit in the page source.
// ─────────────────────────────────────────────

export type Lens = 'ai' | 'systems' | 'web' | 'design';
export type Depth = 1 | 2 | 3;

export const lenses: { id: Lens; label: string }[] = [
  { id: 'ai', label: 'AI' },
  { id: 'systems', label: 'native & systems' },
  { id: 'web', label: 'web' },
  { id: 'design', label: 'design' },
];

export const levels: { depth: Depth; label: string }[] = [
  { depth: 1, label: 'skim' },
  { depth: 2, label: 'read' },
  { depth: 3, label: 'everything' },
];

type Line = { text: string; depth: Depth };

export type Entry = {
  title: string;
  /** shown after the title, lighter */
  sub?: string;
  /** a line of metadata: stack, role, dates */
  meta?: string;
  href?: string;
  tags: Lens[];
  lines: Line[];
};

export const resume = {
  summary: [
    {
      depth: 1,
      text: 'Computer Science Engineering student specializing in Artificial Intelligence and Future Technologies (CGPA 9.1/10) with hands-on experience building AI-powered applications, native cross-platform software, and interactive web products.',
    },
    {
      depth: 2,
      text: 'Proficient in Python, Java, JavaScript, Swift, React, and FastAPI, with practical exposure to Large Language Models, AI agents, and prompt engineering.',
    },
    {
      depth: 3,
      text: 'Delivers projects end to end and independently — from protocol-level systems programming to responsive front-end interfaces — and competes in national-level hackathons.',
    },
    { depth: 3, text: 'Focused on generative AI, human-AI interaction, and responsible AI development.' },
  ] satisfies Line[],

  education: {
    school: 'Chitkara University',
    place: 'Punjab, India',
    degree: 'Bachelor of Engineering (B.E.), Computer Science Engineering — Artificial Intelligence & Future Technologies',
    facts: ['2025 – Present', 'Expected graduation: 2029', 'CGPA: 9.1/10.0 (Semesters I & II)'],
    coursework: [
      'Data Structures & Algorithms',
      'Artificial Intelligence',
      'Python Programming',
      'Java Programming',
      'Object-Oriented Programming',
      'Linear Algebra',
      'Calculus',
      'Digital Electronics & Computer Architecture',
      'Foundations of Computer Science',
    ],
  },

  skills: [
    { title: 'Programming languages', depth: 1, tags: [], items: ['Python', 'Java', 'JavaScript', 'Swift', 'HTML5', 'CSS3'] },
    {
      title: 'Frontend development',
      depth: 1,
      tags: ['web', 'design'],
      items: ['React (React 19)', 'SwiftUI', 'Responsive Web Development', 'Framer Motion', 'GSAP', 'UI/UX Development'],
    },
    { title: 'Backend & APIs', depth: 2, tags: ['web', 'systems'], items: ['FastAPI', 'REST API Design', 'API Integration', 'Socket Programming'] },
    {
      title: 'AI & machine learning',
      depth: 1,
      tags: ['ai'],
      items: ['Large Language Models (LLMs)', 'LangChain', 'AI Agents', 'Prompt Engineering', 'Vector Search (Pinecone)', 'Responsible AI'],
    },
    { title: 'Databases & cloud services', depth: 2, tags: ['web'], items: ['Supabase', 'Firebase', 'Pinecone', 'LocalStorage'] },
    {
      title: 'Tools & platforms',
      depth: 2,
      tags: ['systems', 'design'],
      items: ['Git', 'GitHub', 'Xcode', 'Figma', 'Blender', 'ADB (Android Debug Bridge)', 'macOS', 'Android'],
    },
    {
      title: 'Core concepts',
      depth: 3,
      tags: ['systems'],
      items: ['Data Structures & Algorithms', 'Object-Oriented Programming', 'Computer Architecture', 'Concurrency', 'Client-Server Architecture'],
    },
  ] satisfies { title: string; depth: Depth; tags: Lens[]; items: string[] }[],

  projects: [
    {
      // The PDF calls this PUL; the project has since been renamed Conduit.
      title: 'Conduit',
      sub: 'formerly PUL — Android-to-Mac universal device integration',
      meta: 'Swift, SwiftUI, macOS, Android, VideoToolbox, H.264, AVFoundation, ADB, Socket Programming',
      href: '/projects/conduit/',
      tags: ['systems'],
      lines: [
        {
          depth: 2,
          text: 'Built two native macOS applications in Swift that turn an Android phone into an extension of the Mac — a mirrored, fully controllable screen and a hardware input device.',
        },
        {
          depth: 3,
          text: 'Reimplemented the scrcpy wire protocol client from scratch in Swift, decoding H.264 with VideoToolbox and rendering through AVSampleBufferDisplayLayer for hardware-accelerated, low-latency mirroring.',
        },
        {
          depth: 3,
          text: 'Engineered full bidirectional control: cursor tap, drag, swipe, scroll and long-press, Mac keyboard input, two-way clipboard synchronization, and Opus/AAC audio forwarding decoded into AVAudioEngine.',
        },
        {
          depth: 3,
          text: 'Delivered wireless Wi-Fi connectivity with automatic reconnection and capped exponential backoff, plus continued mirroring while the phone display is powered off.',
        },
        {
          depth: 3,
          text: 'Extended the platform with PUL Device: a multi-touch trackpad with gesture recognition, haptic feedback, media-key injection, ~80 Hz accelerometer and gyroscope streaming, and a live H.264 camera feed.',
        },
        {
          depth: 3,
          text: 'Debugged low-level socket synchronization and connection race conditions to establish reliable concurrent video, audio, and control channels.',
        },
      ],
    },
    {
      title: 'Sahaas',
      sub: 'crowdsourced civic & mental health support platform',
      meta: 'React, FastAPI, Firebase, Supabase, Large Language Models, IVRS',
      href: '/projects/sahaas/',
      tags: ['web', 'ai'],
      lines: [
        {
          depth: 2,
          text: 'Architected a multi-channel platform for surfacing early signals of civic and mental health issues and routing users to appropriate interventions.',
        },
        {
          depth: 3,
          text: 'Designed an ingestion pipeline supporting both web-based reporting and IVRS voice input to reach users across varying levels of digital access.',
        },
        { depth: 3, text: 'Built an AI-assisted workflow for signal identification, prioritization, and continuity of support across follow-ups.' },
        {
          depth: 3,
          text: 'Produced the full solution architecture, technical approach, impact model, and feasibility strategy presented for hackathon evaluation.',
        },
      ],
    },
    {
      title: 'Student Support & Wellbeing AI Agent',
      meta: 'AI Agents, Large Language Models, Prompt Engineering, Responsible AI',
      tags: ['ai'],
      lines: [
        {
          depth: 2,
          text: 'Designed a conversational AI assistant that helps university students manage academic workload, deadlines, and everyday stress.',
        },
        {
          depth: 3,
          text: 'Developed contextual prompting strategies that produce empathetic, personalized responses rather than generic model output.',
        },
        {
          depth: 3,
          text: 'Evaluated responsible AI considerations including context retention, user privacy, emotional dependency risk, and appropriate escalation boundaries for AI-based support.',
        },
      ],
    },
    {
      title: 'CommonGround',
      sub: 'community hobby platform',
      meta: 'React, JavaScript, UI/UX Design, Figma, User Research',
      tags: ['web', 'design'],
      lines: [
        {
          depth: 2,
          text: 'Designed and prototyped a community platform connecting college students and young adults through shared hobbies and interests.',
        },
        {
          depth: 3,
          text: 'Defined a feature set spanning hobby discovery, community groups, mentor interaction, workshops, in-app chat, and location-based exploration.',
        },
        {
          depth: 3,
          text: 'Conducted early-stage user research to identify barriers to learning new hobbies and translated findings into product and interface decisions.',
        },
        {
          depth: 3,
          text: 'Implemented a responsive, accessible interface with a lightweight design system focused on usability and community engagement.',
        },
      ],
    },
  ] satisfies Entry[],

  experience: [
    {
      title: 'EvolveAI, Chitkara University',
      sub: 'Punjab, India',
      meta: 'Student Member, Technical & Creative Contributor · 2025 – Present',
      tags: ['ai', 'design'],
      lines: [
        {
          depth: 2,
          text: 'Contribute to AI-focused student initiatives spanning technical projects, product ideation, and visual communication.',
        },
        { depth: 3, text: 'Develop and present applied AI concepts and technology-focused content to peer and faculty audiences.' },
        { depth: 3, text: 'Collaborate across technical and creative teams to take project ideas from concept through to presentation.' },
      ],
    },
  ] satisfies Entry[],

  hackathons: [
    {
      title: 'Smart India Hackathon (SIH)',
      sub: 'participant',
      tags: ['web', 'ai'],
      lines: [
        { depth: 2, text: 'Developed a technology-driven solution addressing real-world civic and social challenges.' },
        {
          depth: 3,
          text: 'Owned problem analysis, solution architecture, technical approach, value proposition, impact analysis, feasibility assessment, and final presentation.',
        },
      ],
    },
  ] satisfies Entry[],

  interests: [
    'Artificial Intelligence',
    'AI Ethics',
    'Generative AI',
    'AI Agents',
    'Human-AI Interaction',
    'Software Development',
    'Emerging Technologies',
    'Data Structures & Algorithms',
    'UI/UX',
  ],
  languages: ['English', 'Hindi'],
};
