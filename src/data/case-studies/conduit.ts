import type { CaseStudy } from '../../lib/types';

// Everything here is taken from the confirmed feature list. Where the internals aren't
// written up yet, the field is left out and the page says so.
export const conduit: CaseStudy = {
  slug: 'conduit',
  status: 'published',

  intro: {
    built: [
      'Conduit is the final direction of my Android-to-Mac device integration project. It grew out of PUL, the earlier working version, and Conduit is the name it carries forward.',
    ],
  },

  features: [
    {
      title: 'Screen',
      stage: 'done',
      items: ['Wireless Android-to-Mac screen mirroring', 'Hardware H.264 screen decoding', 'Phone screen can stay off while mirroring continues'],
    },
    {
      title: 'Control',
      stage: 'done',
      items: [
        'Mouse and trackpad control',
        'Tap, drag, swipe, scroll and long-press',
        'Mac keyboard input',
        'Phone as a trackpad / input device',
        'Haptic feedback and media-key support',
      ],
    },
    {
      title: 'Sharing',
      stage: 'done',
      items: ['Two-way clipboard', 'Phone audio forwarded to Mac speakers', 'Live phone camera access on the Mac', 'IMU streaming'],
    },
    {
      title: 'Connection',
      stage: 'done',
      items: ['Wi-Fi, no cable', 'Automatic reconnection after unplugging, sleeping or waking'],
    },
  ],

  diagrams: [
    {
      id: 'link',
      title: 'What crosses the link',
      basis: 'built',
      caption:
        'Two native apps and one wireless link, with every stream that crosses it and the way it travels. Drawn from the working feature list; how each stream works inside is still to be written up.',
      nodes: [
        {
          id: 'phone',
          label: 'Android phone',
          kind: 'device',
          col: 0,
          row: 0,
          rows: 8,
          summary: 'The native Android side of Conduit.',
          details: ['Its screen can stay off while mirroring continues', 'Doubles as a trackpad / input device for the Mac'],
          tech: ['Android'],
          stage: 'done',
        },
        {
          id: 'mac',
          label: 'Mac',
          kind: 'device',
          col: 2,
          row: 0,
          rows: 8,
          summary: 'The native macOS side of Conduit.',
          details: ['Shows the mirrored screen', 'Its mouse, trackpad and keyboard drive the phone', 'Plays the phone’s audio through its speakers'],
          tech: ['Swift', 'SwiftUI', 'macOS', 'VideoToolbox', 'AVFoundation'],
          stage: 'done',
        },
        {
          id: 'link',
          label: 'Wireless link',
          kind: 'link',
          col: 1,
          row: 0,
          summary: 'Everything travels over Wi-Fi. There is no cable.',
          details: ['Socket-based communication', 'Reconnects by itself after unplugging, sleeping or waking', 'Scrcpy protocol work and debugging'],
          tech: ['Socket programming', 'ADB'],
          stage: 'done',
        },
        {
          id: 'screen',
          label: 'Screen',
          kind: 'channel',
          col: 1,
          row: 1,
          summary: 'The phone’s screen, mirrored on the Mac.',
          details: ['Wireless Android-to-Mac screen mirroring', 'Hardware H.264 screen decoding', 'Phone screen can stay off while mirroring continues'],
          tech: ['H.264'],
          stage: 'done',
        },
        {
          id: 'control',
          label: 'Control',
          kind: 'channel',
          col: 1,
          row: 2,
          summary: 'The Mac’s own input devices operate the phone.',
          details: ['Mouse and trackpad control', 'Tap, drag, swipe, scroll and long-press', 'Mac keyboard input', 'Haptic feedback and media-key support'],
          stage: 'done',
        },
        {
          id: 'input',
          label: 'Phone as input',
          kind: 'channel',
          col: 1,
          row: 3,
          summary: 'The other way round: the phone becomes an input device for the Mac.',
          details: ['Phone as a trackpad / input device'],
          stage: 'done',
        },
        {
          id: 'clipboard',
          label: 'Clipboard',
          kind: 'channel',
          col: 1,
          row: 4,
          summary: 'Copy on one, paste on the other.',
          details: ['Two-way clipboard'],
          stage: 'done',
        },
        {
          id: 'audio',
          label: 'Audio',
          kind: 'channel',
          col: 1,
          row: 5,
          summary: 'What the phone plays comes out of the Mac.',
          details: ['Phone audio forwarded to Mac speakers'],
          stage: 'done',
        },
        {
          id: 'camera',
          label: 'Camera',
          kind: 'channel',
          col: 1,
          row: 6,
          summary: 'The phone’s camera, live on the Mac.',
          details: ['Live phone camera access on the Mac'],
          stage: 'done',
        },
        {
          id: 'imu',
          label: 'IMU',
          kind: 'channel',
          col: 1,
          row: 7,
          summary: 'The phone’s motion sensors, as a stream.',
          details: ['IMU streaming'],
          stage: 'done',
        },
      ],
      edges: [
        { from: 'phone', to: 'link', flow: 'both' },
        { from: 'link', to: 'mac', flow: 'both' },
        { from: 'phone', to: 'screen', flow: 'forward' },
        { from: 'screen', to: 'mac', flow: 'forward' },
        { from: 'phone', to: 'control', flow: 'back' },
        { from: 'control', to: 'mac', flow: 'back' },
        { from: 'phone', to: 'input', flow: 'forward' },
        { from: 'input', to: 'mac', flow: 'forward' },
        { from: 'phone', to: 'clipboard', flow: 'both' },
        { from: 'clipboard', to: 'mac', flow: 'both' },
        { from: 'phone', to: 'audio', flow: 'forward' },
        { from: 'audio', to: 'mac', flow: 'forward' },
        { from: 'phone', to: 'camera', flow: 'forward' },
        { from: 'camera', to: 'mac', flow: 'forward' },
        { from: 'phone', to: 'imu', flow: 'forward' },
        { from: 'imu', to: 'mac', flow: 'forward' },
      ],
    },
  ],

  mindmap: {
    idea: [
      {
        label: 'Wireless Android-to-Mac integration',
        children: [{ label: 'Mirror your phone' }, { label: 'Control it from your Mac' }, { label: 'Use it as an input device' }],
      },
      { label: 'Began as PUL', note: 'PUL was the earlier working version of this project, before it became Conduit.' },
    ],
    implementation: [
      {
        label: 'Screen',
        stage: 'done',
        children: [
          { label: 'Wireless screen mirroring' },
          { label: 'Hardware H.264 decoding' },
          { label: 'Phone screen can stay off' },
        ],
      },
      {
        label: 'Control',
        stage: 'done',
        children: [
          { label: 'Mouse and trackpad' },
          { label: 'Tap, drag, swipe, scroll, long-press' },
          { label: 'Mac keyboard input' },
          { label: 'Phone as a trackpad' },
          { label: 'Haptics and media keys' },
        ],
      },
      {
        label: 'Sharing',
        stage: 'done',
        children: [{ label: 'Two-way clipboard' }, { label: 'Phone audio on Mac speakers' }, { label: 'Live phone camera' }, { label: 'IMU streaming' }],
      },
      {
        label: 'Connection',
        stage: 'done',
        children: [{ label: 'Wi-Fi, no cable' }, { label: 'Automatic reconnection' }],
      },
      {
        label: 'Under the hood',
        children: [
          { label: 'Native macOS and Android components' },
          { label: 'Socket-based communication' },
          { label: 'Scrcpy protocol work and debugging' },
        ],
      },
    ],
  },

  timeline: [
    { title: 'PUL', stage: 'done', body: 'The earlier working version of this project, before it became Conduit.' },
    {
      title: 'Conduit',
      stage: 'done',
      body: 'The final direction of the project, and the name it carries forward.',
      items: [
        'Screen mirroring with hardware H.264 decoding',
        'Mouse, trackpad and keyboard control',
        'Two-way clipboard, phone audio, live camera and IMU streaming',
        'Wi-Fi, with automatic reconnection',
      ],
    },
  ],

  // Topics only, for now: add `body` paragraphs (and `chose` / `because` / `tradeoff`)
  // to turn any of these into a full deep dive.
  deepDives: [
    { title: 'Native macOS and Android components', kind: 'architecture' },
    { title: 'Socket-based communication', kind: 'protocol' },
    { title: 'Scrcpy protocol work and debugging', kind: 'debugging' },
  ],
};
