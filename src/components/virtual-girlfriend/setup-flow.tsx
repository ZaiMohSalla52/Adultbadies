'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { STYLE_VIBE_OPTIONS } from '@/lib/virtual-girlfriend/outfit-presets';
import { getCompanionLabels } from '@/lib/virtual-girlfriend/companion-labels';
import type { VirtualGirlfriendSetupResult } from '@/lib/virtual-girlfriend/types';
import {
  EYE_SWATCHES,
  HAIR_SWATCHES,
  ORIGIN_SWATCHES,
  SetupOptionVisual,
  type SetupIconId,
} from '@/components/virtual-girlfriend/setup-option-icons';
import { readJsonResponse } from '@/lib/api/read-json-response';
import styles from './setup-flow.module.css';

type BuilderStep =
  | 'sex'
  | 'name'
  | 'origin'
  | 'hairColor'
  | 'hairLength'
  | 'eyeColor'
  | 'bodyType'
  | 'age'
  | 'breastSize'
  | 'styleVibe'
  | 'personality'
  | 'occupation'
  | 'sexuality'
  | 'freeformDetails'
  | 'portrait';

type PortraitCandidate = { id: string; imageDataUrl: string; prompt: string; label: string };

const isHostedPortraitUrl = (value: string | null | undefined) => /^https?:\/\//i.test(String(value ?? '').trim());

const filterPortraitCandidates = (candidates: PortraitCandidate[]) =>
  candidates.filter((candidate) => isHostedPortraitUrl(candidate.imageDataUrl));

type SetupConflict = {
  companionName?: string;
  guidance?: string[];
  topFieldLabels?: string[];
  conflictAreas?: string[];
};

type CreatorState = {
  name: string;
  sex: string;
  origin: string;
  skinTone: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  breastSize: string;
  age: string;
  styleVibe: string;
  occupation: string;
  personality: string;
  sexuality: string;
  freeformDetails: string;
  selectedPortraitPrompt: string;
  selectedPortraitImage: string;
};

type Option = { label: string; value: string };
type IconOption = Option & {
  icon?: SetupIconId;
  swatch?: string;
  swatchGradient?: string;
  eyeColor?: string;
  age?: string;
};
type EmojiOption = Option & { icon: string };

const STEPS: BuilderStep[] = [
  'sex',
  'name',
  'origin',
  'hairColor',
  'hairLength',
  'eyeColor',
  'bodyType',
  'age',
  'breastSize',
  'styleVibe',
  'personality',
  'occupation',
  'portrait',
  'sexuality',
  'freeformDetails',
];

const makeInitialState = (): CreatorState => ({
  name: '',
  sex: 'female',
  origin: '',
  skinTone: '',
  hairColor: '',
  hairLength: '',
  eyeColor: '',
  bodyType: '',
  breastSize: '',
  age: '',
  styleVibe: '',
  occupation: '',
  personality: '',
  sexuality: '',
  freeformDetails: '',
  selectedPortraitPrompt: '',
  selectedPortraitImage: '',
});

const sexOptions: IconOption[] = [
  { label: 'Female', value: 'female', icon: 'sex-female' },
  { label: 'Male', value: 'male', icon: 'sex-male' },
];

const originOptions: IconOption[] = [
  { label: 'Caucasian', value: 'white', swatch: ORIGIN_SWATCHES.white },
  { label: 'East Asian', value: 'asian', swatch: ORIGIN_SWATCHES.asian },
  { label: 'South Asian', value: 'south_asian', swatch: ORIGIN_SWATCHES.south_asian },
  { label: 'Black / African', value: 'black', swatch: ORIGIN_SWATCHES.black },
  { label: 'Latina', value: 'latina', swatch: ORIGIN_SWATCHES.latina },
  { label: 'Middle Eastern', value: 'middle_eastern', swatch: ORIGIN_SWATCHES.middle_eastern },
  { label: 'Mixed', value: 'mixed', swatchGradient: ORIGIN_SWATCHES.mixed },
  { label: 'Random', value: 'random', icon: 'random' },
];

const hairOptions: IconOption[] = [
  { label: 'Black', value: 'black', swatch: HAIR_SWATCHES.black },
  { label: 'Dark brown', value: 'dark brown', swatch: HAIR_SWATCHES['dark brown'] },
  { label: 'Light brown', value: 'light brown', swatch: HAIR_SWATCHES['light brown'] },
  { label: 'Blonde', value: 'blonde', swatch: HAIR_SWATCHES.blonde },
  { label: 'Platinum', value: 'platinum', swatch: HAIR_SWATCHES.platinum },
  { label: 'Auburn', value: 'auburn', swatch: HAIR_SWATCHES.auburn },
  { label: 'Red', value: 'red', swatch: HAIR_SWATCHES.red },
  { label: 'Silver', value: 'silver', swatch: HAIR_SWATCHES.silver },
  { label: 'Random', value: 'random', icon: 'random' },
];

const bodyOptions: IconOption[] = [
  { label: 'Slim', value: 'slim', icon: 'body-slim' },
  { label: 'Petite', value: 'petite', icon: 'body-petite' },
  { label: 'Athletic', value: 'athletic', icon: 'body-athletic' },
  { label: 'Curvy', value: 'curvy', icon: 'body-curvy' },
  { label: 'Plus size', value: 'plus size', icon: 'body-plus' },
  { label: 'Random', value: 'random', icon: 'random' },
];

const breastSizeOptions: IconOption[] = [
  { label: 'Small', value: 'small', icon: 'chest-small' },
  { label: 'Medium', value: 'medium', icon: 'chest-medium' },
  { label: 'Large', value: 'large', icon: 'chest-large' },
  { label: 'Random', value: 'random', icon: 'random' },
];

const ageOptions: IconOption[] = [
  { label: '18', value: '18', age: '18' },
  { label: '21', value: '21', age: '21' },
  { label: '24', value: '24', age: '24' },
  { label: '27', value: '27', age: '27' },
  { label: '30', value: '30', age: '30' },
  { label: '35', value: '35', age: '35' },
  { label: '40', value: '40', age: '40' },
  { label: 'Random', value: 'random', icon: 'random' },
];

const occupationOptions: IconOption[] = [
  { label: 'Student', value: 'student', icon: 'occ-student' },
  { label: 'Teacher', value: 'teacher', icon: 'occ-teacher' },
  { label: 'Nurse', value: 'nurse', icon: 'occ-nurse' },
  { label: 'Fitness trainer', value: 'fitness trainer', icon: 'occ-fitness' },
  { label: 'Chef', value: 'chef', icon: 'occ-chef' },
  { label: 'Lawyer', value: 'lawyer', icon: 'occ-lawyer' },
  { label: 'Artist', value: 'artist', icon: 'occ-artist' },
  { label: 'Pilot', value: 'pilot', icon: 'occ-pilot' },
  { label: 'Doctor', value: 'doctor', icon: 'occ-doctor' },
  { label: 'Model', value: 'model', icon: 'occ-model' },
  { label: 'Musician', value: 'musician', icon: 'occ-musician' },
  { label: 'Random', value: 'random', icon: 'random' },
];

const hairLengthOptions: IconOption[] = [
  { label: 'Short', value: 'short', icon: 'hair-length-short' },
  { label: 'Medium', value: 'medium', icon: 'hair-length-medium' },
  { label: 'Long', value: 'long', icon: 'hair-length-long' },
  { label: 'Random', value: 'random', icon: 'random' },
];

const eyeColorOptions: IconOption[] = [
  { label: 'Brown', value: 'brown', icon: 'eye', eyeColor: EYE_SWATCHES.brown },
  { label: 'Dark brown', value: 'dark brown', icon: 'eye', eyeColor: EYE_SWATCHES['dark brown'] },
  { label: 'Blue', value: 'blue', icon: 'eye', eyeColor: EYE_SWATCHES.blue },
  { label: 'Green', value: 'green', icon: 'eye', eyeColor: EYE_SWATCHES.green },
  { label: 'Hazel', value: 'hazel', icon: 'eye', eyeColor: EYE_SWATCHES.hazel },
  { label: 'Amber', value: 'amber', icon: 'eye', eyeColor: EYE_SWATCHES.amber },
  { label: 'Random', value: 'random', icon: 'random' },
];

const personalityOptions: EmojiOption[] = [
  { label: 'Warm & romantic', value: 'warm_romantic', icon: '❤️' },
  { label: 'Playful & teasing', value: 'playful_tease', icon: '😜' },
  { label: 'Sultry & seductive', value: 'sultry_seductive', icon: '🔥' },
  { label: 'Dominant & teasing', value: 'dominant_tease', icon: '⛓️' },
  { label: 'Submissive & eager', value: 'submissive_eager', icon: '🫦' },
  { label: 'Wild & uninhibited', value: 'wild_uninhibited', icon: '💋' },
  { label: 'Confident & bold', value: 'confident_bold', icon: '💪' },
  { label: 'Intellectual', value: 'intellectual', icon: '🧠' },
  { label: 'Sweet & caring', value: 'sweet_caring', icon: '🥰' },
  { label: 'Sarcastic & witty', value: 'sarcastic_witty', icon: '😏' },
  { label: 'Mysterious', value: 'mysterious', icon: '🌙' },
  { label: 'Bubbly & energetic', value: 'bubbly_energetic', icon: '✨' },
  { label: 'Random', value: 'random', icon: '🎲' },
];

const sexualityOptions: EmojiOption[] = [
  { label: 'Straight', value: 'straight', icon: '⚤' },
  { label: 'Gay', value: 'gay', icon: '⚣' },
  { label: 'Bisexual', value: 'bisexual', icon: '⚥' },
  { label: 'Pansexual', value: 'pansexual', icon: '🝬' },
  { label: 'Random', value: 'random', icon: '🎲' },
];

const detailChips = [
  'Adventurous',
  'Hopeless romantic',
  'High libido',
  'Slow-burn tease',
  'Loves lingerie',
  'Open-minded',
  'Kinky curious',
  'Praise kink',
  'Roleplay lover',
  'Fitness obsession',
  'Exhibitionist energy',
  'Passionate lover',
  'Night owl',
  'Deep thinker',
  'Foodie',
  'Gamer',
];

const renderOptionVisual = (option: IconOption) => {
  if (option.swatch || option.swatchGradient) {
    return (
      <span
        className={styles.swatchVisual}
        style={{ background: option.swatchGradient ?? option.swatch }}
      />
    );
  }

  if (option.age) {
    return <span className={styles.ageVisual}>{option.age}</span>;
  }

  return (
    <SetupOptionVisual
      icon={option.icon}
      eyeColor={option.eyeColor}
    />
  );
};

const deriveTone = (personality: string): string => {
  const map: Record<string, string> = {
    warm_romantic: 'Warm & caring',
    playful_tease: 'Flirty & witty',
    sultry_seductive: 'Bold & spicy',
    dominant_tease: 'Bold & spicy',
    submissive_eager: 'Warm & caring',
    wild_uninhibited: 'Bold & spicy',
    confident_bold: 'Bold & spicy',
    intellectual: 'Calm & cozy',
    sweet_caring: 'Warm & caring',
    sarcastic_witty: 'Flirty & witty',
    mysterious: 'Bold & spicy',
    bubbly_energetic: 'Flirty & witty',
  };
  return map[personality] || 'Warm & caring';
};

const deriveAffectionStyle = (personality: string): string => {
  const map: Record<string, string> = {
    warm_romantic: 'Slow-burn romance',
    playful_tease: 'High flirt energy',
    sultry_seductive: 'High flirt energy',
    dominant_tease: 'High flirt energy',
    submissive_eager: 'Slow-burn romance',
    wild_uninhibited: 'High flirt energy',
    confident_bold: 'High flirt energy',
    intellectual: 'Balanced affection',
    sweet_caring: 'Slow-burn romance',
    sarcastic_witty: 'Balanced affection',
    mysterious: 'Slow-burn romance',
    bubbly_energetic: 'High flirt energy',
  };
  return map[personality] || 'Balanced affection';
};

const normalizeToneKey = (tone: string): string => {
  const map: Record<string, string> = {
    'warm & caring': 'supportive',
    'flirty & witty': 'flirty',
    'bold & spicy': 'direct',
    'calm & cozy': 'romantic',
    'playful & teasing': 'playful',
    'deep & thoughtful': 'thoughtful',
  };
  return map[tone.toLowerCase().trim()] || tone.toLowerCase().replace(/[^a-z]/g, '_');
};

const deriveArchetype = (personality: string, tone: string): string => {
  const map: Record<string, string> = {
    warm_romantic_romantic: 'Romantic Muse',
    warm_romantic_flirty: 'Romantic Muse',
    playful_tease_playful: 'Fun Buddy',
    playful_tease_flirty: 'Sultry Tease',
    confident_bold_direct: 'Power Partner',
    confident_bold_playful: 'Fun Buddy',
    intellectual_thoughtful: 'Intellectual Equal',
    intellectual_romantic: 'Romantic Muse',
    sweet_caring_romantic: 'Romantic Muse',
    sweet_caring_supportive: 'Romantic Muse',
    sarcastic_witty_playful: 'Fun Buddy',
    sarcastic_witty_direct: 'Intellectual Equal',
    mysterious_romantic: 'Sultry Tease',
    mysterious_direct: 'Power Partner',
    bubbly_energetic_playful: 'Fun Buddy',
    bubbly_energetic_flirty: 'Sultry Tease',
    sultry_seductive_direct: 'Sultry Tease',
    sultry_seductive_flirty: 'Sultry Tease',
    dominant_tease_direct: 'Power Partner',
    dominant_tease_playful: 'Sultry Tease',
    submissive_eager_romantic: 'Romantic Muse',
    submissive_eager_supportive: 'Romantic Muse',
    wild_uninhibited_direct: 'Sultry Tease',
    wild_uninhibited_playful: 'Fun Buddy',
  };
  const normalizedTone = normalizeToneKey(tone);
  const key = `${personality}_${normalizedTone}`.toLowerCase();
  return map[key] || 'Romantic Muse';
};

const deriveVisualAesthetic = (styleVibe: string, personality: string): string => {
  const map: Record<string, string> = {
    casual_warm_romantic: 'Soft golden hour',
    casual_bubbly_energetic: 'Bright lifestyle',
    elegant_warm_romantic: 'Luxury editorial',
    elegant_confident_bold: 'High fashion drama',
    edgy_playful_tease: 'Neon nightlife',
    edgy_mysterious: 'Dark aesthetic',
    bohemian_sweet_caring: 'Earthy warm tones',
    bohemian_intellectual: 'Vintage warmth',
    sporty_bubbly_energetic: 'Active lifestyle',
    sporty_confident_bold: 'Athletic editorial',
    professional_intellectual: 'Clean minimal',
    professional_confident_bold: 'Corporate power',
    seductive_sultry_seductive: 'Boudoir glamour',
    lingerie_sultry_seductive: 'Lace and silk intimacy',
    glamorous_confident_bold: 'High fashion drama',
    athletic_confident_bold: 'Athletic thirst-trap editorial',
  };
  const vibeFallbacks: Record<string, string> = {
    casual: 'Natural casual everyday',
    elegant: 'Sophisticated elegant evening',
    seductive: 'Sultry boudoir glamour',
    lingerie: 'Lace-forward intimate styling',
    athletic: 'Athletic thirst-trap realism',
    sporty: 'Athletic active lifestyle',
    glamorous: 'Glam nightlife luxury',
    bohemian: 'Boho free-spirited artistic',
    edgy: 'Edgy urban streetwear',
    vintage: 'Retro vintage classic',
    minimalist: 'Clean minimalist modern',
    professional: 'Polished professional lifestyle',
  };
  const key = `${styleVibe}_${personality}`.toLowerCase();
  return map[key] || vibeFallbacks[styleVibe?.toLowerCase()] || `${styleVibe || 'Natural'} style`;
};

const deriveSkinTone = (origin: string): string => {
  const map: Record<string, string> = {
    white: 'fair',
    asian: 'light',
    south_asian: 'medium',
    black: 'dark',
    latina: 'tan',
    middle_eastern: 'olive',
    mixed: 'medium',
    random: 'medium',
  };
  return map[origin] || 'medium';
};

const buildDerivedFromState = (current: CreatorState) => {
  const tone = deriveTone(current.personality);
  const affectionStyle = deriveAffectionStyle(current.personality);
  const archetype = deriveArchetype(current.personality, tone);
  const visualAesthetic = deriveVisualAesthetic(current.styleVibe, current.personality);
  const skinTone = deriveSkinTone(current.origin);
  return { tone, affectionStyle, archetype, visualAesthetic, skinTone };
};

const portraitTraitsKeyFromState = (current: CreatorState) =>
  [
    current.sex,
    current.origin,
    current.hairColor,
    current.hairLength,
    current.eyeColor,
    current.bodyType,
    current.breastSize,
    current.age,
    current.styleVibe,
    current.personality,
    current.occupation,
    current.freeformDetails,
  ].join('|');

const makeRandomName = () => {
  const first = ['Luna', 'Ava', 'Mia', 'Sofia', 'Nora', 'Kai', 'Noah', 'Liam', 'Ethan', 'Leo'];
  const last = ['Rose', 'Blake', 'River', 'Skye', 'Stone', 'Vale', 'Fox', 'Quinn'];
  return `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
};

export const VirtualGirlfriendSetupFlow = ({ createNew = false }: { createNew?: boolean }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflictHelp, setConflictHelp] = useState<SetupConflict | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<CreatorState>(makeInitialState);
  const [generationStarted, setGenerationStarted] = useState(false);
  const [portraitsLoading, setPortraitsLoading] = useState(false);
  const [portraitCandidates, setPortraitCandidates] = useState<PortraitCandidate[]>([]);
  const [portraitsForTraitsKey, setPortraitsForTraitsKey] = useState<string | null>(null);
  const [recoverableCompanionId, setRecoverableCompanionId] = useState<string | null>(null);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const portraitGenInFlight = useRef(false);

  const step = STEPS[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);
  const labels = useMemo(() => getCompanionLabels(state.sex), [state.sex]);
  const portraitTraitsKey = useMemo(() => portraitTraitsKeyFromState(state), [state]);

  useEffect(() => {
    if (!portraitsForTraitsKey || portraitsForTraitsKey === portraitTraitsKey) return;
    if (portraitsLoading) return;

    setPortraitCandidates([]);
    setPortraitsForTraitsKey(null);
    setState((current) => ({
      ...current,
      selectedPortraitImage: '',
      selectedPortraitPrompt: '',
    }));

    if (step === 'portrait') {
      void maybeGeneratePortraits(true);
    }
  }, [portraitTraitsKey, portraitsForTraitsKey, portraitsLoading, step]);

  useEffect(() => {
    if (step !== 'portrait' || portraitsLoading) return;
    const validCount = filterPortraitCandidates(portraitCandidates).length;
    if (validCount > 0 && portraitsForTraitsKey === portraitTraitsKey) return;
    void maybeGeneratePortraits(validCount > 0);
  }, [step]);

  useEffect(() => {
    if (step !== 'portrait' || !carouselRef.current) return;
    const element = carouselRef.current;
    const onScroll = () => {
      const children = Array.from(element.children) as HTMLElement[];
      if (!children.length) return;
      const center = element.scrollLeft + element.clientWidth / 2;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      children.forEach((child, index) => {
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const distance = Math.abs(center - childCenter);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      setActiveDotIndex(bestIndex);
    };
    onScroll();
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [step, portraitCandidates.length]);

  const setField = <K extends keyof CreatorState>(key: K, value: CreatorState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const validateCurrentStep = (): string | null => {
    if (step === 'name' && !state.name.trim()) return 'Name is required.';
    if (step === 'origin' && !state.origin) return 'Choose ethnicity.';
    if (step === 'hairColor' && !state.hairColor) return 'Choose hair color.';
    if (step === 'hairLength' && !state.hairLength) return 'Choose hair length.';
    if (step === 'eyeColor' && !state.eyeColor) return 'Choose eye color.';
    if (step === 'bodyType' && !state.bodyType) return 'Choose body type.';
    if (step === 'age' && !state.age) return 'Choose age.';
    if (step === 'breastSize' && state.sex === 'female' && !state.breastSize) return 'Choose chest size.';
    if (step === 'styleVibe' && !state.styleVibe) return `Choose ${labels.stylePrompt}.`;
    if (step === 'portrait' && !state.selectedPortraitImage) return 'Pick one portrait to continue.';
    if (step === 'occupation' && !state.occupation) return 'Choose occupation.';
    if (step === 'personality' && !state.personality) return 'Choose personality.';
    if (step === 'sexuality' && !state.sexuality) return 'Choose sexual preference.';
    return null;
  };

  const maybeGeneratePortraits = async (force = false, stateSnapshot?: CreatorState) => {
    if (portraitGenInFlight.current) return;

    const workingState = stateSnapshot ?? state;
    const traitsKey = portraitTraitsKeyFromState(workingState);
    const validExisting = filterPortraitCandidates(portraitCandidates);

    if (!force && validExisting.length > 0 && portraitsForTraitsKey === traitsKey) return;

    if (!workingState.name.trim()) {
      setError('Enter a name before generating portraits.');
      return;
    }

    const derived = buildDerivedFromState(workingState);
    portraitGenInFlight.current = true;
    setPortraitsLoading(true);
    setError(null);
    setConflictHelp(null);
    setRecoverableCompanionId(null);

    try {
      const distinctnessResponse = await fetch('/api/virtual-girlfriend/distinctness-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createNew,
          name: workingState.name.trim(),
          sex: workingState.sex,
          age: workingState.age,
          origin: workingState.origin,
          hairColor: workingState.hairColor,
          hairLength: workingState.hairLength,
          eyeColor: workingState.eyeColor,
          skinTone: derived.skinTone,
          bodyType: workingState.bodyType,
          styleVibe: workingState.styleVibe,
          occupation: workingState.occupation,
          personality: workingState.personality,
          breastSize: workingState.breastSize,
          sexuality: workingState.sexuality,
          affectionStyle: derived.affectionStyle,
          tone: derived.tone,
          archetype: derived.archetype,
          visualAesthetic: derived.visualAesthetic,
          freeformDetails: workingState.freeformDetails,
        }),
      });

      const distinctnessBody = await readJsonResponse<{
        ok?: boolean;
        message?: string;
        conflict?: SetupConflict;
      }>(distinctnessResponse);

      if (!distinctnessResponse.ok || !distinctnessBody.ok) {
        setError(distinctnessBody.message ?? 'This profile is too similar to an existing companion.');
        setConflictHelp(distinctnessBody.conflict ?? null);
        return;
      }

      const response = await fetch('/api/virtual-girlfriend/portrait-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sex: workingState.sex,
          origin: workingState.origin,
          hairColor: workingState.hairColor,
          hairLength: workingState.hairLength,
          eyeColor: workingState.eyeColor,
          skinTone: derived.skinTone,
          bodyType: workingState.bodyType,
          breastSize: workingState.breastSize,
          age: workingState.age,
          styleVibe: workingState.styleVibe,
          personality: workingState.personality,
          occupation: workingState.occupation,
          freeformDetails: workingState.freeformDetails,
        }),
      });

      const body = await readJsonResponse<{ candidates?: PortraitCandidate[]; error?: string }>(response);
      if (!response.ok || !body.candidates?.length) throw new Error(body.error ?? 'Unable to generate portraits now.');

      const validCandidates = filterPortraitCandidates(body.candidates);
      if (validCandidates.length < 2) {
        throw new Error('Portrait previews could not be published. Check image storage settings and try again.');
      }

      setPortraitCandidates(validCandidates);
      setPortraitsForTraitsKey(traitsKey);

      const firstCandidate = validCandidates[0];
      if (firstCandidate && (!workingState.selectedPortraitImage || force)) {
        setState((current) => ({
          ...current,
          selectedPortraitImage: firstCandidate.imageDataUrl,
          selectedPortraitPrompt: firstCandidate.prompt,
        }));
      }
    } catch (candidateError) {
      setError(candidateError instanceof Error ? candidateError.message : 'Portrait generation failed.');
    } finally {
      portraitGenInFlight.current = false;
      setPortraitsLoading(false);
    }
  };

  const goNext = async () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    let next = stepIndex + 1;
    if (STEPS[next] === 'breastSize' && state.sex !== 'female') {
      next += 1;
    }
    next = Math.min(STEPS.length - 1, next);

    setError(null);
    setConflictHelp(null);
    setStepIndex(next);

    if (STEPS[next] === 'portrait') {
      await maybeGeneratePortraits(false, state);
    }
  };

  const advanceToNextStep = (stateSnapshot?: CreatorState) => {
    const workingState = stateSnapshot ?? state;
    let next = stepIndex + 1;
    if (STEPS[next] === 'breastSize' && workingState.sex !== 'female') {
      next += 1;
    }
    next = Math.min(STEPS.length - 1, next);

    setError(null);
    setConflictHelp(null);
    setStepIndex(next);

    if (STEPS[next] === 'portrait') {
      void maybeGeneratePortraits(false, workingState);
    }
  };

  const goBack = () => {
    if (stepIndex === 0) return;

    let prev = stepIndex - 1;
    if (STEPS[prev] === 'breastSize' && state.sex !== 'female') {
      prev -= 1;
    }
    prev = Math.max(0, prev);

    setError(null);
    setConflictHelp(null);
    setStepIndex(prev);

    if (STEPS[prev] === 'portrait' && portraitCandidates.length === 0 && !portraitsLoading) {
      void maybeGeneratePortraits();
    }
  };

  const handleOptionSelect = <K extends keyof CreatorState>(field: K, value: CreatorState[K]) => {
    const nextState = { ...state, [field]: value };
    setField(field, value);
    setError(null);
    advanceToNextStep(nextState);
  };

  const appendDetailChip = (chip: string) => {
    setState((current) => {
      if (current.freeformDetails.toLowerCase().includes(chip.toLowerCase())) return current;
      const separator = current.freeformDetails.trim().length ? ', ' : '';
      return { ...current, freeformDetails: `${current.freeformDetails}${separator}${chip}` };
    });
  };

  const submit = () => {
    if (!state.name.trim() || !state.selectedPortraitImage || !state.selectedPortraitPrompt) {
      setError('Complete required steps before generating.');
      return;
    }

    const { tone, affectionStyle, archetype, visualAesthetic, skinTone } = buildDerivedFromState(state);

    setGenerationStarted(true);
    setError(null);
    setConflictHelp(null);
    setRecoverableCompanionId(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/virtual-girlfriend/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            createNew,
            name: state.name.trim(),
            sex: state.sex,
            age: state.age,
            origin: state.origin,
            hairColor: state.hairColor,
            hairLength: state.hairLength,
            eyeColor: state.eyeColor,
            skinTone,
            bodyType: state.bodyType,
            styleVibe: state.styleVibe,
            occupation: state.occupation,
            personality: state.personality,
            breastSize: state.breastSize,
            sexuality: state.sexuality,
            affectionStyle,
            tone,
            archetype,
            visualAesthetic,
            freeformDetails: state.freeformDetails,
            selectedPortraitPrompt: state.selectedPortraitPrompt,
            selectedPortraitImage: state.selectedPortraitImage,
          }),
        });

        const body = await readJsonResponse<VirtualGirlfriendSetupResult>(response);

        if (
          body.state === 'generating'
          || body.state === 'ready'
          || body.state === 'partial_success'
          || body.state === 'review_pending'
        ) {
          const destination =
            body.redirectTo
            ?? (body.companionId ? `/virtual-girlfriend/chat?companionId=${body.companionId}` : '/virtual-girlfriend/chat');
          router.push(destination);
          router.refresh();
          return;
        }

        if (body.state === 'blocked_pre_gen') {
          setError(body.message ?? 'Generation did not start because this setup is too similar to an existing companion.');
          setConflictHelp((body.conflict as SetupConflict | undefined) ?? null);
          setGenerationStarted(false);
          setStepIndex(STEPS.length - 1);
          return;
        }

        if (body.state === 'failed') {
          setError(body.message ?? 'Profile was saved, but image generation failed.');
          setRecoverableCompanionId(body.companionId ?? null);
          setConflictHelp(null);
          setGenerationStarted(false);
          setStepIndex(STEPS.length - 1);
          return;
        }

        if (!response.ok) {
          setError(body.message ?? 'Server error while creating your companion setup.');
          setConflictHelp(null);
          setGenerationStarted(false);
          setStepIndex(STEPS.length - 1);
          return;
        }
      } catch {
        setError('Unable to submit setup right now. Generation has not started yet. Please try again.');
        setConflictHelp(null);
        setRecoverableCompanionId(null);
        setGenerationStarted(false);
      }
    });
  };

  const regeneratePortraits = () => {
    setPortraitCandidates([]);
    setPortraitsForTraitsKey(null);
    setField('selectedPortraitImage', '');
    setField('selectedPortraitPrompt', '');
    void maybeGeneratePortraits(true);
  };

  const isSubmitting = generationStarted || pending;
  const showContinue = step === 'name' || step === 'portrait';
  const showCreate = step === 'freeformDetails';
  const visiblePortraitCandidates = useMemo(
    () => filterPortraitCandidates(portraitCandidates),
    [portraitCandidates],
  );
  const nameOr = (withName: string, withoutName: string) =>
    state.name.trim() ? withName.replace('{name}', state.name.trim()) : withoutName;

  return (
    <div className={styles.creatorContainer}>
      <div className={styles.topNav}>
        <button type="button" className={styles.iconButton} onClick={goBack} disabled={stepIndex === 0 || isSubmitting} aria-label="Go back">
          ←
        </button>
        <button type="button" className={styles.iconButton} onClick={() => router.push('/virtual-girlfriend')} aria-label="Close setup">
          ✕
        </button>
      </div>

      <div className={styles.progressBar} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {isSubmitting ? (
        <div className={styles.generatingState}>
          <div className={styles.generatingOrb} />
          <h2 className={styles.stepTitle}>Creating {state.name || 'your companion'}…</h2>
          <p className={styles.generatingSubtext}>Building profile, photos, and memory setup</p>
        </div>
      ) : (
        <>
          <div className={styles.stepTransition} key={step}>
            {step === 'sex' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Girlfriend or boyfriend?</h2>
                <p className={styles.loadingSubtext}>Build your perfect AI companion — fully custom, adult, and yours.</p>
                <div className={styles.genderGrid}>
                  {sexOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${styles.genderCard} ${state.sex === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('sex', option.value)}
                    >
                      <span className={styles.genderVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'name' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>What&apos;s their name?</h2>
                <input
                  autoFocus
                  className={styles.textInput}
                  placeholder="Enter a name"
                  maxLength={40}
                  value={state.name}
                  onChange={(event) => setField('name', event.target.value)}
                />
                <button type="button" className={styles.skipButton} onClick={() => setField('name', makeRandomName())}>
                  Skip — generate random name
                </button>
              </div>
            )}

            {step === 'origin' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s ethnicity', 'Choose ethnicity')}</h2>
                <div className={styles.optionGridThree}>
                  {originOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.origin === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('origin', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'hairColor' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s hair color', 'Choose hair color')}</h2>
                <div className={styles.optionGridThree}>
                  {hairOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.hairColor === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('hairColor', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'hairLength' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s hair length', 'Choose hair length')}</h2>
                <div className={styles.optionGridThree}>
                  {hairLengthOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.hairLength === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('hairLength', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'eyeColor' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s eye color', 'Choose eye color')}</h2>
                <div className={styles.optionGridThree}>
                  {eyeColorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.eyeColor === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('eyeColor', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'bodyType' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s body type', 'Choose body type')}</h2>
                <div className={styles.optionGridThree}>
                  {bodyOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.bodyType === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('bodyType', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'age' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('How old is {name}?', 'How old?')}</h2>
                <div className={styles.optionGridThree}>
                  {ageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.age === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('age', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'breastSize' && state.sex === 'female' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s chest size', 'Choose chest size')}</h2>
                <div className={styles.optionGridThree}>
                  {breastSizeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.breastSize === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('breastSize', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'portrait' && (
              <div className={styles.portraitStep}>
                {portraitsLoading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.loadingOrb} />
                    <h2 className={styles.stepTitle}>{nameOr(`Creating {name}'s portrait`, labels.generatingPortrait)}</h2>
                    <p className={styles.loadingSubtext}>Picking the perfect look...</p>
                    <div className={styles.traitSummary}>
                      {state.sex ? <span className={styles.traitChip}>{state.sex === 'female' ? 'Female' : 'Male'}</span> : null}
                      {state.origin ? <span className={styles.traitChip}>{originOptions.find((o) => o.value === state.origin)?.label}</span> : null}
                      {state.hairColor ? <span className={styles.traitChip}>{state.hairColor} hair</span> : null}
                      {state.eyeColor ? <span className={styles.traitChip}>{state.eyeColor} eyes</span> : null}
                      {state.bodyType ? <span className={styles.traitChip}>{state.bodyType}</span> : null}
                      {state.age ? <span className={styles.traitChip}>Age {state.age}</span> : null}
                      {state.styleVibe ? (
                        <span className={styles.traitChip}>
                          {STYLE_VIBE_OPTIONS.find((o) => o.value === state.styleVibe)?.label ?? state.styleVibe}
                        </span>
                      ) : null}
                      {state.personality ? (
                        <span className={styles.traitChip}>
                          {personalityOptions.find((o) => o.value === state.personality)?.label ?? state.personality}
                        </span>
                      ) : null}
                      {state.occupation ? (
                        <span className={styles.traitChip}>
                          {occupationOptions.find((o) => o.value === state.occupation)?.label ?? state.occupation}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : visiblePortraitCandidates.length === 0 ? (
                  <div className={styles.portraitEmptyState}>
                    <h2 className={styles.stepTitle}>{nameOr(`Pick {name}'s portrait`, labels.pickPortrait)}</h2>
                    <p className={styles.loadingSubtext}>
                      {error ?? 'Portrait previews did not load. Tap below to generate looks.'}
                    </p>
                    <button type="button" className={styles.regeneratePrimaryButton} onClick={regeneratePortraits} disabled={portraitsLoading}>
                      {portraitsLoading ? 'Generating looks…' : 'Generate looks'}
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className={styles.stepTitle}>{nameOr(`Pick {name}'s portrait`, labels.pickPortrait)}</h2>
                    <p className={styles.loadingSubtext}>Tap a look below — the first option is pre-selected for you.</p>
                    {error ? <p className={styles.portraitInlineError}>{error}</p> : null}
                    {(() => {
                      const previewUrl =
                        state.selectedPortraitImage
                        || visiblePortraitCandidates[activeDotIndex]?.imageDataUrl
                        || visiblePortraitCandidates[0]?.imageDataUrl
                        || null;
                      return previewUrl ? (
                        <div className={styles.portraitPreviewWrap}>
                          <img
                            src={previewUrl}
                            alt="Portrait preview"
                            className={styles.portraitPreviewImage}
                            loading="eager"
                            decoding="async"
                          />
                          <span className={styles.portraitPreviewBadge}>
                            {state.selectedPortraitImage ? 'Selected' : 'Preview'}
                          </span>
                        </div>
                      ) : null;
                    })()}
                    <button type="button" className={styles.skipButton} onClick={regeneratePortraits} disabled={portraitsLoading}>
                      Regenerate looks
                    </button>
                    <div className={styles.portraitPickerGrid}>
                      {visiblePortraitCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          className={`${styles.portraitPickerCard} ${
                            state.selectedPortraitImage === candidate.imageDataUrl ? styles.portraitPickerCardSelected : ''
                          }`}
                          onClick={() => {
                            setField('selectedPortraitPrompt', candidate.prompt);
                            setField('selectedPortraitImage', candidate.imageDataUrl);
                          }}
                        >
                          <img
                            src={candidate.imageDataUrl}
                            alt={candidate.label}
                            className={styles.portraitPickerImage}
                            loading="eager"
                            decoding="async"
                          />
                          <span className={styles.portraitPickerLabel}>{candidate.label}</span>
                        </button>
                      ))}
                    </div>
                    <div className={styles.carouselContainer}>
                      <div className={styles.carouselTrack} ref={carouselRef}>
                        {visiblePortraitCandidates.map((candidate) => (
                          <button
                            key={`carousel-${candidate.id}`}
                            type="button"
                            className={`${styles.carouselCard} ${
                              state.selectedPortraitImage === candidate.imageDataUrl ? styles.carouselCardSelected : ''
                            }`}
                            onClick={() => {
                              setField('selectedPortraitPrompt', candidate.prompt);
                              setField('selectedPortraitImage', candidate.imageDataUrl);
                            }}
                          >
                            <img src={candidate.imageDataUrl} alt={candidate.label} className={styles.carouselImage} />
                          </button>
                        ))}
                      </div>
                      <div className={styles.carouselDots}>
                        {visiblePortraitCandidates.map((_, i) => (
                          <span key={i} className={`${styles.dot} ${i === activeDotIndex ? styles.dotActive : ''}`} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 'styleVibe' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s style', `Choose ${labels.stylePrompt}`)}</h2>
                <p className={styles.loadingSubtext}>{labels.wardrobeHint}</p>
                <div className={styles.optionGridThree}>
                  {STYLE_VIBE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.styleVibe === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('styleVibe', option.value)}
                    >
                      <span className={styles.cardIcon}>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'occupation' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('What does {name} do?', 'Choose occupation')}</h2>
                <div className={styles.optionGridThree}>
                  {occupationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.iconOptionCard} ${state.occupation === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('occupation', option.value)}
                    >
                      <span className={styles.iconVisual}>{renderOptionVisual(option)}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'personality' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s personality', 'Choose personality')}</h2>
                <div className={styles.optionGridThree}>
                  {personalityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.personality === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('personality', option.value)}
                    >
                      <span className={styles.cardIcon}>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'sexuality' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('{name}\'s preference', 'Sexual preference')}</h2>
                <div className={styles.optionGridThree}>
                  {sexualityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.sexuality === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('sexuality', option.value)}
                    >
                      <span className={styles.cardIcon}>{option.icon}</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'freeformDetails' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>{nameOr('Anything special about {name}?', 'Any special details?')}</h2>
                <textarea
                  rows={6}
                  maxLength={400}
                  className={styles.textInput}
                  placeholder="Describe anything special about their personality, backstory, or appearance..."
                  value={state.freeformDetails}
                  onChange={(event) => setField('freeformDetails', event.target.value)}
                />
                <div className={styles.traitPresetWrap}>
                  {detailChips.map((chip) => (
                    <button key={chip} type="button" className={styles.traitPresetChip} onClick={() => appendDetailChip(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error ? <p className={styles.errorText}>{error}</p> : null}
          {recoverableCompanionId ? (
            <button type="button" className={styles.backTextButton} onClick={() => router.push(`/virtual-girlfriend/profile?companionId=${recoverableCompanionId}`)}>
              Open created profile
            </button>
          ) : null}
          {conflictHelp ? (
            <div className={styles.conflictBox}>
              <p>Too close to {conflictHelp.companionName ?? 'an existing companion'}.</p>
              {conflictHelp.topFieldLabels?.length ? <p>Most overlapping areas: {conflictHelp.topFieldLabels.slice(0, 3).join(', ')}.</p> : null}
            </div>
          ) : null}

          <div className={styles.navArea}>
            <button type="button" className={styles.backTextButton} disabled={stepIndex === 0 || isSubmitting} onClick={goBack}>
              Back
            </button>
            {showContinue ? (
              <button type="button" className={styles.continueButton} onClick={() => void goNext()} disabled={isSubmitting || portraitsLoading}>
                Continue
              </button>
            ) : null}
            {showCreate ? (
              <button type="button" className={styles.createButton} onClick={submit} disabled={isSubmitting || portraitsLoading}>
                Create {labels.roleShort.toLowerCase()}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
