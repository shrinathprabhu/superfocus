// Public product facts only. Never put device-local tasks or goals in this data.
export const site = {
  name: 'SuperFocus',
  title: 'SuperFocus — Free Pomodoro Timer, Tasks & Focus Music',
  description:
    'A free Pomodoro timer with to-do lists, sprint planning, goals and 10 focus music tracks. Install the offline PWA; your tasks stay on your device.',
  canonical: 'https://superfocus.lowkey.tools/',
  repository: 'https://github.com/shrinathprabhu/superfocus',
  socialImage: {
    url: '/og/superfocus-v2.png',
    width: 1200,
    height: 630,
    alt: 'SuperFocus: One thing at a time. Pomodoro, tasks and quiet music, with a 25-minute focus timer.',
  },
  creator: { name: 'Shrinath Prabhu', url: 'https://shrinath.me' },
  creatorSocial: 'https://x.com/shrinath_prabhu',
  publisher: { name: 'OwlEye Analytics', url: 'https://owleye.dev' },
} as const;

// One companion from the lowkey.tools collection, relevant to a focus session.
export const relatedTools = [
  {
    name: 'SuperBrain',
    url: 'https://lowkey.tools/superbrain',
    prompt: 'A thought for later?',
    description:
      'Park the idea in a private notebook, then get back to the task at hand.',
  },
] as const;

export const quickStart = [
  'Add a task, choose a planned date, and optionally set a start time or deadline.',
  'Start a 25-minute focus session. Play an ambient track or add your own audio.',
  'Take a 5-minute short break, or a 15-minute long break after four focus sessions. Adjust this rhythm in Settings.',
] as const;

export const faqs = [
  {
    id: 'what-is-superfocus',
    question: 'What is SuperFocus?',
    answer:
      'SuperFocus is a free Pomodoro timer, to-do list and sprint planner from lowkey.tools. It combines timed focus sessions, goals, daily task review and ten original ambient music tracks in an installable web app.',
  },
  {
    id: 'pomodoro-timer',
    question: 'How does the Pomodoro timer work?',
    answer:
      'The default rhythm is 25 minutes of focus, a 5-minute short break and a 15-minute long break after four focus sessions. You can change these durations, pause or reset a timer, and associate a focus session with a task. Each next session starts when you choose.',
  },
  {
    id: 'offline-and-mobile',
    question: 'Can I use SuperFocus offline and on my phone?',
    answer:
      'Yes. Open SuperFocus online first and wait for the offline-ready message. The workspace and all ten built-in music tracks are then cached for offline use. Install the PWA from a supported browser; on iPhone or iPad, use Safari’s Share menu and Add to Home Screen. The layout also works in a regular mobile browser.',
  },
  {
    id: 'privacy-and-backups',
    question: 'Where are my tasks and goals stored?',
    answer:
      'Tasks, goals, sessions, settings and uploaded audio stay in IndexedDB in your browser. SuperFocus does not send this workspace data to a server. There is no cloud sync: another browser, device or domain has a separate workspace. Export a backup in Settings before clearing browser data. Backups include your workspace, but uploaded audio must be added again.',
  },
  {
    id: 'unfinished-tasks',
    question: 'What happens to unfinished tasks the next day?',
    answer:
      'When you next open SuperFocus, it asks you to review open tasks planned before today. Choose which to carry over and which to abandon. Carryover moves the planned date and shifts any start time and deadline by the same number of days. “Won’t do” archives a task as abandoned.',
  },
  {
    id: 'sprints-and-statuses',
    question: 'Which sprint lengths and task statuses are available?',
    answer:
      'Choose a one-day, one-week, two-week or one-month sprint cycle and an anchor date. Tasks can be to do, in progress, blocked, done or abandoned. Carryover and “Won’t do” are task actions. Tasks can also have goals, planned dates, start times and deadlines.',
  },
  {
    id: 'alarms-in-background',
    question: 'Will an alarm sound when a focus session or break ends?',
    answer:
      'Yes. Sound alerts are enabled by default, with a test button in Settings. You can also allow system notifications. Alarms in the background depend on browser and operating-system rules; a closed, suspended or killed app cannot reliably alert you. SuperFocus checks elapsed time when you return. Keep the app open for the most dependable alerts.',
  },
  {
    id: 'focus-music',
    question: 'Is the focus music royalty free? Can I add my own?',
    answer:
      'The ten built-in ambient compositions are original and released under CC0. You can repeat a track, shuffle randomly, or upload audio files from your device, up to 30 MB per file. Uploaded files stay in your browser. Spotify, Apple Music and YouTube Music connections are not included.',
  },
] as const;

export function structuredData() {
  const personId = `${site.creator.url}/#person`;
  const organizationId = `${site.publisher.url}/#organization`;
  const appId = `${site.canonical}#app`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        ...site.creator,
        sameAs: [site.creatorSocial],
      },
      {
        '@type': 'Organization',
        '@id': organizationId,
        ...site.publisher,
        founder: { '@id': personId },
      },
      {
        '@type': 'WebApplication',
        '@id': appId,
        name: site.name,
        url: site.canonical,
        description: site.description,
        image: new URL(site.socialImage.url, site.canonical).href,
        applicationCategory: 'ProductivityApplication',
        operatingSystem: 'Any operating system with a modern web browser',
        browserRequirements:
          'JavaScript and IndexedDB required. HTTPS for offline installation.',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        inLanguage: 'en',
        author: { '@id': personId },
        publisher: { '@id': organizationId },
        featureList: [
          'Customizable Pomodoro timer with sound alerts',
          'To-do list and sprint planning',
          'Daily task carryover review',
          'Goals and focus session history',
          '10 original CC0 ambient music tracks and local audio uploads',
          'Offline PWA with device-local IndexedDB storage',
        ],
      },
      {
        '@type': 'WebPage',
        '@id': `${site.canonical}#webpage`,
        url: site.canonical,
        name: site.title,
        description: site.description,
        inLanguage: 'en',
        mainEntity: { '@id': appId },
        author: { '@id': personId },
        publisher: { '@id': organizationId },
        hasPart: { '@id': `${site.canonical}#faq` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${site.canonical}#faq`,
        isPartOf: { '@id': `${site.canonical}#webpage` },
        mainEntity: faqs.map(({ id, question, answer }) => ({
          '@type': 'Question',
          '@id': `${site.canonical}#${id}`,
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      },
    ],
  };
}
