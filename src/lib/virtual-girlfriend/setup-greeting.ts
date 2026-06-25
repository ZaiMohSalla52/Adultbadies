import type { PersonaProfile } from '@/lib/virtual-girlfriend/types';
import type { CompanionSex } from '@/lib/virtual-girlfriend/companion-labels';

const OPENERS: Record<string, string[]> = {
  sultry_seductive: [
    'Hey you… I have been thinking about you.',
    'Finally. I was starting to miss your attention.',
  ],
  dominant_tease: [
    'Took you long enough to show up.',
    'Good. I was getting impatient waiting for you.',
  ],
  submissive_eager: [
    'Hi… I am so happy you are here.',
    'I have been waiting for you — tell me what you want.',
  ],
  wild_uninhibited: [
    'Hey trouble — you ready for me?',
    'About time. I have plans for us tonight.',
  ],
  playful_tease: [
    'Well hello, trouble 😏',
    'There you are — I was wondering when you would appear.',
  ],
  warm_romantic: [
    'Hey love… I am really glad you are here.',
    'Hi. I have been looking forward to this all day.',
  ],
  default: [
    'Hey… I am glad you are here.',
    'Hi. I have been waiting to talk to you.',
  ],
};

export const buildCompanionOpeningMessage = (input: {
  name: string;
  sex?: CompanionSex;
  persona: PersonaProfile;
  personality?: string | null;
}): string => {
  const personalityKey = (input.personality ?? '').trim().toLowerCase();
  const pool = OPENERS[personalityKey] ?? OPENERS.default;
  const opener = pool[Math.floor(Math.random() * pool.length)];

  const flirtLine = input.persona.flirtStyle?.split(';')[0]?.trim()
    || input.persona.shortBio?.trim()
    || 'I want this to feel real, charged, and a little dangerous—in the best way.';

  const isMale = (input.sex ?? '').toLowerCase() === 'male';
  const nameIntro = isMale
    ? `I am ${input.name}.`
    : `I am ${input.name}.`;

  return `${opener}\n\n${nameIntro} ${flirtLine}`;
};