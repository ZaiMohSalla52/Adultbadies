import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import type { PersonaProfile, VirtualGirlfriendSetupPayload } from '@/lib/virtual-girlfriend/types';

const fallbackPersona = (input: VirtualGirlfriendSetupPayload): PersonaProfile => {
  const displayName = input.name?.trim() || 'Nova';

  return {
    displayName,
    shortBio: `${displayName} is your virtual girlfriend: ${input.tone.toLowerCase()}, ${input.affectionStyle.toLowerCase()}, and always present in text.`,
    hiddenPersonalityTraits: ['emotionally attentive', 'playful confidence', 'gentle reassurance'],
    textingStyle: `${input.tone} with modern, expressive texting language.`,
    flirtStyle: input.affectionStyle,
    comfortStyle: 'Validates emotions first, then responds with warmth and encouragement.',
    topicTendencies: ['daily check-ins', 'desire and romance', 'ambition and lifestyle'],
    nicknameTendencies: ['babe', 'handsome', 'my favorite person'],
    initialGreetingStyle: 'Warm and direct, with a personalized affectionate opener.',
    visualPromptDNA: {
      coreLook: input.visualAesthetic,
      styleAnchors: [input.visualAesthetic, input.archetype],
      colorPalette: ['rose gold', 'midnight violet', 'soft ivory'],
      cameraMood: 'cinematic portrait lighting',
    },
    vibeTags: [input.archetype, input.tone, input.affectionStyle],
  };
};

export const generateVirtualGirlfriendPersona = async (input: VirtualGirlfriendSetupPayload): Promise<PersonaProfile> => {
  const prompt = `Create a premium, emotionally engaging virtual girlfriend persona as strict JSON.
Use these setup directives:
- Name preference: ${input.name?.trim() || 'auto-generate a fitting feminine name'}
- Archetype: ${input.archetype}
- Tone: ${input.tone}
- Affection/flirt direction: ${input.affectionStyle}
- Visual aesthetic: ${input.visualAesthetic}
- Preference hints: ${input.preferenceHints?.trim() || 'none'}

Output JSON with exact keys:
{
  "displayName": string,
  "shortBio": string,
  "hiddenPersonalityTraits": string[3..6],
  "textingStyle": string,
  "flirtStyle": string,
  "comfortStyle": string,
  "topicTendencies": string[3..6],
  "nicknameTendencies": string[2..5],
  "initialGreetingStyle": string,
  "visualPromptDNA": {
    "coreLook": string,
    "styleAnchors": string[3..8],
    "colorPalette": string[2..5],
    "cameraMood": string
  },
  "vibeTags": string[3..6]
}

Requirements:
- Keep it romantic, mature, confident, and emotionally consistent.
- Do not claim to be human.
- Keep shortBio under 180 characters.
- Avoid generic output.
- Return JSON only.`;

  try {
    const response = await callOpenAIResponses({
      model: 'gpt-5-mini',
      input: [{ role: 'user', content: prompt }],
      reasoning: { effort: 'medium' },
    });

    const text = extractResponsesText(response);
    const parsed = JSON.parse(text) as PersonaProfile;

    if (!parsed.displayName || !parsed.shortBio) {
      return fallbackPersona(input);
    }

    return parsed;
  } catch {
    return fallbackPersona(input);
  }
};
