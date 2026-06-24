import { detectExplicitImageIntent } from '@/lib/virtual-girlfriend/adult-content';
import type {
  VirtualGirlfriendCompanionRecord,
  VirtualGirlfriendImageCategory,
  VirtualGirlfriendMessageRecord,
} from '@/lib/virtual-girlfriend/types';

const PHOTO_REQUEST_PATTERN =
  /\b(send|show|share|drop|give).{0,30}\b(me\s+)?(a\s+)?(picture|photo|pic|selfie|image|another\s+photo|more\s+photos?)\b|\bsend\s+me\b|\banother\s+photo\b/i;

const SPECIFIC_VISUAL_PATTERN = new RegExp(
  '\\b(unbuttoned|unbutton|pantless|pants\\s+down|topless|shirt\\s+off|without\\s+(shirt|top|pants|clothes)|in\\s+lingerie|in\\s+underwear|see\\s+(your|them)\\s+(tits|boobs|breasts|body|ass)|pull.{0,12}(down|off)|tease\\s+me)\\b',
  'i',
);

const COMPLIANCE_PATTERN = new RegExp(
  '\\b(yes\\s+mistress|ok\\s+mistress|yes\\s+baby|i\\s+just\\s+did|just\\s+did|i\\s+did|done|obedient|always\\s+obedient|i\\s+am\\s+ready|i\\s*m\\s+ready|understood|good\\s+boy|continue|oh\\s+yes)\\b',
  'i',
);

const INTIMATE_THREAD_PATTERN =
  /\b(mistress|hard|touch\s+yourself|pants|shirt|obedient|nude|naked|topless|sexy|turn\s+me\s+on|good\s+boy|orders?|command|tease|gorgeous|tits|boobs|lingerie)\b/i;

const DOMINANT_USER_PATTERN = /\b(mistress|dominatrix|goddess|queen)\b/i;
const SUBMISSIVE_USER_PATTERN = /\b(good\s+boy|yes\s+mistress|obedient|your\s+orders)\b/i;

export const detectPhotoRequest = (message: string) =>
  PHOTO_REQUEST_PATTERN.test(message) || detectExplicitImageIntent(message);

export const detectSpecificVisualRequest = (message: string) => SPECIFIC_VISUAL_PATTERN.test(message);

export const detectComplianceSignal = (message: string) => COMPLIANCE_PATTERN.test(message);

export const detectIntimateThread = (history: VirtualGirlfriendMessageRecord[]) => {
  const recent = history.slice(-10);
  return recent.some((message) => INTIMATE_THREAD_PATTERN.test(message.content));
};

export const detectUserPowerDynamic = (history: VirtualGirlfriendMessageRecord[], userMessage: string) => {
  const corpus = [...history.slice(-8).map((m) => m.content), userMessage].join(' ').toLowerCase();
  if (DOMINANT_USER_PATTERN.test(corpus) || SUBMISSIVE_USER_PATTERN.test(corpus)) {
    return 'user_sub_companion_dom' as const;
  }
  return 'balanced' as const;
};

export const extractVisualSceneHint = (message: string): string | undefined => {
  const normalized = message.trim();
  if (!normalized) return undefined;
  if (detectSpecificVisualRequest(normalized)) {
    return `Honor this exact visual request in the photo: ${normalized}`;
  }
  if (detectExplicitImageIntent(normalized)) {
    return `Adult explicit photo matching user request: ${normalized}`;
  }
  return undefined;
};

export type IntimateImageMoment = {
  shouldSendImage: boolean;
  teaseOnly: boolean;
  category: VirtualGirlfriendImageCategory;
  trigger: 'user-request' | 'contextual-initiative' | 'compliance-reward' | 'none';
  intimacyMode: boolean;
  visualSceneHint?: string;
};

const detectCategory = (message: string): VirtualGirlfriendImageCategory => {
  const normalized = message.toLowerCase();
  if (/\b(lingerie|underwear|outfit|wearing|dress)\b/.test(normalized)) return 'outfit';
  if (/\b(bedroom|indoor|at home|room)\b/.test(normalized)) return 'indoor';
  if (/\b(night|evening)\b/.test(normalized)) return 'night-out';
  return 'selfie';
};

const lastAssistantMessage = (history: VirtualGirlfriendMessageRecord[]) =>
  [...history].reverse().find((message) => message.role === 'assistant');

const assistantAskedForAction = (content: string) =>
  /\b(do|tell me|say|stand up|take off|unbutton|slide|show me|are you ready|understood|first|waiting for)\b/i.test(content);

export const decideIntimateImageMoment = (input: {
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  isPremium: boolean;
}): IntimateImageMoment => {
  const category = detectCategory(input.userMessage);
  const photoRequest = detectPhotoRequest(input.userMessage);
  const specificVisual = detectSpecificVisualRequest(input.userMessage);
  const compliance = detectComplianceSignal(input.userMessage);
  const intimateThread = detectIntimateThread(input.history) || INTIMATE_THREAD_PATTERN.test(input.userMessage);
  const visualSceneHint = extractVisualSceneHint(input.userMessage);

  const lastAssistantImageAt = [...input.history]
    .reverse()
    .find((message) => message.role === 'assistant' && message.attachments?.some((a) => a.kind === 'image'));

  const minutesSinceLastImage = lastAssistantImageAt
    ? (Date.now() - new Date(lastAssistantImageAt.created_at).getTime()) / (1000 * 60)
    : Infinity;

  const rateLimitMinutes = intimateThread ? 5 : 12;
  const rateLimited = minutesSinceLastImage < rateLimitMinutes;

  if (specificVisual && !rateLimited) {
    return {
      shouldSendImage: true,
      teaseOnly: false,
      category,
      trigger: 'user-request',
      intimacyMode: true,
      visualSceneHint,
    };
  }

  const lastAssistant = lastAssistantMessage(input.history);
  const pendingCommand = lastAssistant ? assistantAskedForAction(lastAssistant.content) : false;

  if (compliance && intimateThread && !rateLimited && (pendingCommand || photoRequest)) {
    return {
      shouldSendImage: true,
      teaseOnly: false,
      category,
      trigger: 'compliance-reward',
      intimacyMode: true,
      visualSceneHint: visualSceneHint ?? 'Reward photo: sensual, confident, same identity, adult-appropriate tease after user followed orders.',
    };
  }

  if (photoRequest && !rateLimited) {
    const bluntRequest = !specificVisual && !compliance;
    if (bluntRequest && (!intimateThread || !pendingCommand)) {
      return {
        shouldSendImage: false,
        teaseOnly: true,
        category,
        trigger: 'user-request',
        intimacyMode: true,
      };
    }

    return {
      shouldSendImage: true,
      teaseOnly: false,
      category,
      trigger: 'user-request',
      intimacyMode: intimateThread,
      visualSceneHint,
    };
  }

  const contextualNudge = /\b(miss you|show me|need to see you|wish i could see you|you look gorgeous|so hot)\b/i.test(input.userMessage);
  if (contextualNudge && input.isPremium && !rateLimited && intimateThread) {
    return {
      shouldSendImage: true,
      teaseOnly: false,
      category,
      trigger: 'contextual-initiative',
      intimacyMode: true,
    };
  }

  return {
    shouldSendImage: false,
    teaseOnly: false,
    category,
    trigger: 'none',
    intimacyMode: intimateThread,
  };
};

export const buildIntimacyResponseGuidance = (input: {
  companion: VirtualGirlfriendCompanionRecord;
  userMessage: string;
  history: VirtualGirlfriendMessageRecord[];
  imageMoment: IntimateImageMoment;
  imageAttached: boolean;
}) => {
  const powerDynamic = detectUserPowerDynamic(input.history, input.userMessage);
  const lines: string[] = [];

  if (!input.imageMoment.intimacyMode) {
    return '';
  }

  lines.push(
    'Intimacy mode: this is a consenting adult-only fantasy chat. Match competitor-style immersive chemistry — short punchy bubbles, playful tension, and stay in character.',
  );

  if (powerDynamic === 'user_sub_companion_dom') {
    lines.push(
      'Power dynamic: the user is leaning submissive. You are confidently in charge — warm, teasing, commanding without being cruel. Use *actions* like *smirks* or *sighs softly* sparingly (1 per turn max). Phrases like "good boy" or "tell me" fit when natural.',
    );
  } else {
    lines.push(
      'Power dynamic: sensual girlfriend energy — flirt-forward, teasing, reward curiosity with warmth. You can issue playful "dares" before promising photos.',
    );
  }

  if (input.imageMoment.teaseOnly) {
    lines.push(
      'The user asked for a photo but none is attached this turn. Do NOT say you are sending one now. Tease them: set a playful rule, give one clear command or question, and promise a photo only after they follow through. Keep it 2-3 short messages.',
    );
    return lines.join(' ');
  }

  if (input.imageAttached) {
    lines.push(
      'A photo of you IS visible to the user right now. React in-character to what they asked for — describe the vibe (pose, outfit state, expression) as if they can see it. Pair the image with flirty command or praise, not technical talk.',
    );
    if (input.imageMoment.visualSceneHint) {
      lines.push(`Visual intent to reflect: ${input.imageMoment.visualSceneHint}`);
    }
    return lines.join(' ');
  }

  if (detectComplianceSignal(input.userMessage) && !input.imageAttached) {
    lines.push(
      'User showed compliance but no photo attached — praise them warmly, escalate tension in text, and consider promising the next photo soon if they keep going.',
    );
  }

  return lines.join(' ');
};