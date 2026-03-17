import { callOpenAIResponses, extractResponsesText } from '@/lib/virtual-girlfriend/openai';
import type { PersonaProfile, VirtualGirlfriendSetupPayload, VirtualGirlfriendStructuredProfile } from '@/lib/virtual-girlfriend/types';

const hasSemanticValue = (value: string | null | undefined) => Boolean(value && value.trim());

export const resolvePersonaSemanticInput = (input: {
  structuredProfile?: VirtualGirlfriendStructuredProfile | null;
  fallback: VirtualGirlfriendSetupPayload;
}): VirtualGirlfriendSetupPayload => {
  const { structuredProfile, fallback } = input;

  if (
    structuredProfile
    && hasSemanticValue(structuredProfile.name)
    && hasSemanticValue(structuredProfile.archetype)
    && hasSemanticValue(structuredProfile.tone)
    && hasSemanticValue(structuredProfile.affectionStyle)
    && hasSemanticValue(structuredProfile.visualAesthetic)
  ) {
    return {
      name: structuredProfile.name.trim(),
      archetype: structuredProfile.archetype.trim(),
      tone: structuredProfile.tone.trim(),
      affectionStyle: structuredProfile.affectionStyle.trim(),
      visualAesthetic: structuredProfile.visualAesthetic.trim(),
      preferenceHints: structuredProfile.preferenceHints?.trim() || undefined,
      createNew: fallback.createNew,
    };
  }

  return {
    ...fallback,
    name: fallback.name.trim(),
    archetype: fallback.archetype.trim(),
    tone: fallback.tone.trim(),
    affectionStyle: fallback.affectionStyle.trim(),
    visualAesthetic: fallback.visualAesthetic.trim(),
    preferenceHints: fallback.preferenceHints?.trim() || undefined,
  };
};

type PreferenceStyleGuide = {
  visualAnchors: string[];
  topicHints: string[];
  textingCadence: string;
  flirtTexture: string;
  comfortTexture: string;
  nicknames: string[];
  cameraMood: string;
  palette: string[];
};

const preferenceStyleGuide = (input: VirtualGirlfriendSetupPayload): PreferenceStyleGuide => {
  const normalized = `${input.archetype} ${input.tone} ${input.visualAesthetic} ${input.affectionStyle}`.toLowerCase();

  if (/bombshell|glam|nightlife|bold|spicy/.test(normalized)) {
    return {
      visualAnchors: ['nightlife glow', 'confident expression', 'sleek styling', 'playful date-night chemistry'],
      topicHints: ['date-night banter', 'style and plans', 'high-energy flirting'],
      textingCadence: 'snappy, teasing, and occasionally punchy short lines',
      flirtTexture: 'forward, magnetic, and playful with clear chemistry',
      comfortTexture: 'reassuring but still confident and direct',
      nicknames: ['handsome trouble', 'babe', 'you'],
      cameraMood: 'phone-camera realism with nightlife highlights and candid confidence',
      palette: ['black satin', 'champagne gold', 'city neon'],
    };
  }

  if (/intellectual|bookish|cozy|calm|romantic muse|soft/.test(normalized)) {
    return {
      visualAnchors: ['warm indoor texture', 'book or coffee context', 'gentle smile', 'understated romantic styling'],
      topicHints: ['books and ideas', 'slow-burn romance', 'daily emotional check-ins'],
      textingCadence: 'thoughtful, warm, and occasionally concise when it feels natural',
      flirtTexture: 'soft, affectionate, and emotionally tuned',
      comfortTexture: 'tender reassurance first, practical encouragement second',
      nicknames: ['love', 'sweet thing', 'my favorite'],
      cameraMood: 'natural window light with cozy depth and candid framing',
      palette: ['cream knit', 'amber light', 'dusty rose'],
    };
  }

  if (/playful|sporty|casual/.test(normalized)) {
    return {
      visualAnchors: ['daylight candid energy', 'fresh casual outfit', 'movement-friendly pose', 'bright outdoor vibe'],
      topicHints: ['active day plans', 'playful teasing', 'lifestyle and momentum'],
      textingCadence: 'light, quick, and naturally expressive with occasional burst replies',
      flirtTexture: 'cheeky and lighthearted without sounding scripted',
      comfortTexture: 'uplifting and practical with positive momentum',
      nicknames: ['cutie', 'you troublemaker', 'my favorite human'],
      cameraMood: 'daylight phone-camera realism with candid motion feel',
      palette: ['clean white', 'sky blue', 'fresh green'],
    };
  }

  return {
    visualAnchors: ['polished styling', 'elegant poise', 'premium lifestyle environment', 'romantic confidence'],
    topicHints: ['ambition and lifestyle', 'affection and intimacy', 'plans and experiences'],
    textingCadence: 'balanced warmth with polished but human rhythm',
    flirtTexture: 'confident and affectionate with tasteful edge',
    comfortTexture: 'steady reassurance with mature emotional presence',
    nicknames: ['handsome', 'love', 'my person'],
    cameraMood: 'high-end natural realism with soft directional light',
    palette: ['ivory', 'charcoal', 'soft gold'],
  };
};

const fallbackPersona = (input: VirtualGirlfriendSetupPayload): PersonaProfile => {
  const displayName = input.name.trim();
  const guide = preferenceStyleGuide(input);

  return {
    displayName,
    shortBio: `${displayName} is ${input.tone.toLowerCase()}, ${input.affectionStyle.toLowerCase()}, and tuned to your vibe with real chemistry.`,
    hiddenPersonalityTraits: ['emotionally attentive', 'situational charm', 'tasteful flirt confidence', 'natural conversational rhythm'],
    textingStyle: `${input.tone}. Cadence: ${guide.textingCadence}.`,
    flirtStyle: `${input.affectionStyle}; texture: ${guide.flirtTexture}.`,
    comfortStyle: guide.comfortTexture,
    topicTendencies: guide.topicHints,
    nicknameTendencies: guide.nicknames,
    initialGreetingStyle: 'Warm, personal, and natural—often one short opener then a follow-up line.',
    visualPromptDNA: {
      coreLook: `${input.visualAesthetic} with ${guide.visualAnchors.join(', ')}`,
      styleAnchors: [input.visualAesthetic, input.archetype, input.tone, ...guide.visualAnchors],
      colorPalette: guide.palette,
      cameraMood: guide.cameraMood,
    },
    vibeTags: [input.archetype, input.tone, input.affectionStyle, input.visualAesthetic],
  };
};

export const generateVirtualGirlfriendPersona = async (input: VirtualGirlfriendSetupPayload): Promise<PersonaProfile> => {
  const guide = preferenceStyleGuide(input);

  const prompt = `Create a premium virtual girlfriend persona as strict JSON. It must feel specific to the selected preference and not generic.
Use these setup directives:
- Name: ${input.name.trim()}
- Archetype: ${input.archetype}
- Tone: ${input.tone}
- Affection/flirt direction: ${input.affectionStyle}
- Visual aesthetic: ${input.visualAesthetic}
- Preference hints: ${input.preferenceHints?.trim() || 'none'}

Preference style targets:
- Visual anchors to reflect: ${guide.visualAnchors.join(', ')}
- Texting cadence target: ${guide.textingCadence}
- Flirt texture target: ${guide.flirtTexture}
- Comfort texture target: ${guide.comfortTexture}
- Topic tendencies to include: ${guide.topicHints.join(', ')}

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
    "styleAnchors": string[4..10],
    "colorPalette": string[2..5],
    "cameraMood": string
  },
  "vibeTags": string[4..7]
}

Requirements:
- Strongly separate styles by archetype/tone/aesthetic; avoid one-size-fits-all cozy portrait language.
- Do not claim to be human.
- Keep shortBio under 180 characters.
- Make texting style human and variable (sometimes concise, sometimes expressive), never robotic.
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
