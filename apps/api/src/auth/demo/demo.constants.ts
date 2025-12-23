export type DemoSeedUserProfile = {
  username: string;
  fullName: string;
  bio: string;
  profilePictureUrl?: string;
};

export const DEMO_SEED_USERS: DemoSeedUserProfile[] = [
  {
    username: 'demo_seed_ava',
    fullName: 'Ava Thompson',
    bio: 'Product leader • shipping signal-first social experiences.',
    profilePictureUrl: 'https://picsum.photos/id/64/200/200',
  },
  {
    username: 'demo_seed_bryn',
    fullName: 'Bryn Chen',
    bio: 'AI engineer • turning models into features with great UX.',
    profilePictureUrl: 'https://picsum.photos/id/91/200/200',
  },
  {
    username: 'demo_seed_cam',
    fullName: 'Cameron Patel',
    bio: 'Design engineer • prototypes, polish, performance.',
    profilePictureUrl: 'https://picsum.photos/id/1027/200/200',
  },
  {
    username: 'demo_seed_dani',
    fullName: 'Dani Rivera',
    bio: 'Growth • experiments, funnels, and real retention.',
    profilePictureUrl: 'https://picsum.photos/id/1005/200/200',
  },
  {
    username: 'demo_seed_eli',
    fullName: 'Eli Morgan',
    bio: 'Founder • building calm products for busy teams.',
    profilePictureUrl: 'https://picsum.photos/id/1001/200/200',
  },
  {
    username: 'demo_seed_fran',
    fullName: 'Frances Kim',
    bio: 'Data science • metrics, models, and meaningful insights.',
    profilePictureUrl: 'https://picsum.photos/id/1012/200/200',
  },
  {
    username: 'demo_seed_gabe',
    fullName: 'Gabriel Singh',
    bio: 'Infra • reliability, observability, and clean deploys.',
    profilePictureUrl: 'https://picsum.photos/id/1003/200/200',
  },
  {
    username: 'demo_seed_hana',
    fullName: 'Hana Lee',
    bio: 'Community • cultivating thoughtful conversations.',
    profilePictureUrl: 'https://picsum.photos/id/1024/200/200',
  },
  {
    username: 'demo_seed_ivan',
    fullName: 'Ivan Petrov',
    bio: 'Security • threat modeling and pragmatic hardening.',
    profilePictureUrl: 'https://picsum.photos/id/1008/200/200',
  },
  {
    username: 'demo_seed_jules',
    fullName: 'Jules Martin',
    bio: 'PM • clarity, priorities, and execution.',
    profilePictureUrl: 'https://picsum.photos/id/1020/200/200',
  },
  {
    username: 'demo_seed_kai',
    fullName: 'Kai Johnson',
    bio: 'Mobile • delightful experiences, shipped weekly.',
    profilePictureUrl: 'https://picsum.photos/id/1011/200/200',
  },
  {
    username: 'demo_seed_lina',
    fullName: 'Lina Alvarez',
    bio: 'Research • qualitative signals + product intuition.',
    profilePictureUrl: 'https://picsum.photos/id/1025/200/200',
  },
];

export const DEMO_SEED_POSTS_PER_USER = 9;
export const DEMO_SEED_FOLLOW_FRACTION = 0.5;
export const DEMO_SEED_FOLLOW_MIN = 5;
export const DEMO_USER_INITIAL_POSTS = 9;

export const DEMO_SEED_POST_TEMPLATES = [
  'Three tiny habits that keep my roadmap honest.',
  'A UI change that made onboarding feel effortless.',
  'The fastest performance win I shipped this month.',
  'A simple heuristic for deciding what not to build.',
  'Notes from a deep dive on feed ranking and trust.',
  'Small copy changes, big clarity. Words matter.',
  'A checklist I use before every production deploy.',
  'I asked an AI assistant to rewrite this post — it helped.',
  'The most underrated part of good design: constraints.',
  'Building with empathy: ship the smallest thing that helps.',
];

export const DEMO_NOTIFICATION_COMMENT_TEMPLATES = [
  'This is so good.',
  'Love this idea — totally agree.',
  'Nice. Can you share more details?',
  '🔥',
  'This made my day.',
  'Ok this is sick.',
];
