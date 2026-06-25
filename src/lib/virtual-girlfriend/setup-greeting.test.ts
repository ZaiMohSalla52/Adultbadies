import { describe, expect, it } from 'vitest';
import { buildCompanionOpeningMessage } from '@/lib/virtual-girlfriend/setup-greeting';
import type { PersonaProfile } from '@/lib/virtual-girlfriend/types';

const persona: PersonaProfile = {
  displayName: 'Luna',
  shortBio: 'Magnetic and a little dangerous.',
  hiddenPersonalityTraits: ['flirty'],
  textingStyle: 'Warm',
  flirtStyle: 'Bold chemistry from the first message.',
  comfortStyle: 'Tender',
  topicTendencies: ['dates'],
  nicknameTendencies: ['babe'],
  initialGreetingStyle: 'Short opener',
  visualPromptDNA: {
    coreLook: 'Glam',
    styleAnchors: ['night'],
    colorPalette: ['black'],
    cameraMood: 'soft',
  },
  vibeTags: ['bold'],
};

describe('buildCompanionOpeningMessage', () => {
  it('includes name and flirt line', () => {
    const message = buildCompanionOpeningMessage({
      name: 'Luna',
      sex: 'female',
      persona,
      personality: 'sultry_seductive',
    });
    expect(message).toContain('Luna');
    expect(message).toContain('Bold chemistry');
  });
});