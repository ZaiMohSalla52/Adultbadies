'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { VirtualGirlfriendSetupResult } from '@/lib/virtual-girlfriend/types';
import styles from './setup-flow.module.css';

type BuilderStep =
  | 'sex'
  | 'name'
  | 'origin'
  | 'hairColor'
  | 'hairLength'
  | 'eyeColor'
  | 'bodyType'
  | 'breastSize'
  | 'age'
  | 'styleVibe'
  | 'portrait'
  | 'occupation'
  | 'personality'
  | 'sexuality'
  | 'freeformDetails';

type PortraitCandidate = { id: string; imageDataUrl: string; prompt: string; label: string };

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
type PhotoOption = Option & { image?: string; icon?: string };
type EmojiOption = Option & { icon: string };

const STEPS: BuilderStep[] = [
  'sex',
  'name',
  'origin',
  'hairColor',
  'hairLength',
  'eyeColor',
  'bodyType',
  'breastSize',
  'age',
  'styleVibe',
  'portrait',
  'occupation',
  'personality',
  'sexuality',
  'freeformDetails',
];

const initialState: CreatorState = {
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
};

const sexOptions: PhotoOption[] = [
  {
    label: 'Female',
    value: 'female',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face',
  },
  {
    label: 'Male',
    value: 'male',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face',
  },
];

const originOptions: PhotoOption[] = [
  { label: 'Caucasian', value: 'white', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=300&fit=crop&crop=face' },
  { label: 'East Asian', value: 'asian', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop&crop=face' },
  { label: 'South Asian', value: 'south_asian', image: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=300&h=300&fit=crop&crop=face' },
  { label: 'Black / African', value: 'black', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&h=300&fit=crop&crop=face' },
  { label: 'Latina', value: 'latina', image: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=300&h=300&fit=crop&crop=face' },
  { label: 'Middle Eastern', value: 'middle_eastern', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300&h=300&fit=crop&crop=face' },
  { label: 'Mixed', value: 'mixed', image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&h=300&fit=crop&crop=face' },
  { label: 'Random', value: 'random', icon: '🎲' },
];

const hairOptions: Option[] = [
  { label: 'Black', value: 'black' },
  { label: 'Dark brown', value: 'dark brown' },
  { label: 'Light brown', value: 'light brown' },
  { label: 'Blonde', value: 'blonde' },
  { label: 'Platinum', value: 'platinum' },
  { label: 'Auburn', value: 'auburn' },
  { label: 'Red', value: 'red' },
  { label: 'Silver', value: 'silver' },
  { label: 'Random', value: 'random' },
];

const hairLengthOptions: Option[] = [
  { label: 'Short', value: 'short' },
  { label: 'Medium', value: 'medium' },
  { label: 'Long', value: 'long' },
  { label: 'Random', value: 'random' },
];

const eyeColorOptions: Option[] = [
  { label: 'Brown', value: 'brown' },
  { label: 'Dark brown', value: 'dark brown' },
  { label: 'Blue', value: 'blue' },
  { label: 'Green', value: 'green' },
  { label: 'Hazel', value: 'hazel' },
  { label: 'Amber', value: 'amber' },
  { label: 'Random', value: 'random' },
];

const bodyOptions: Option[] = [
  { label: 'Slim', value: 'slim' },
  { label: 'Petite', value: 'petite' },
  { label: 'Athletic', value: 'athletic' },
  { label: 'Curvy', value: 'curvy' },
  { label: 'Plus size', value: 'plus size' },
  { label: 'Random', value: 'random' },
];

const breastSizeOptions: Option[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'Random', value: 'random' },
];

const ageOptions: Option[] = [
  { label: '18', value: '18' },
  { label: '21', value: '21' },
  { label: '24', value: '24' },
  { label: '27', value: '27' },
  { label: '30', value: '30' },
  { label: '35', value: '35' },
  { label: '40', value: '40' },
  { label: 'Random', value: 'random' },
];

const styleVibeOptions: Option[] = [
  { label: 'Casual', value: 'casual' },
  { label: 'Elegant', value: 'elegant' },
  { label: 'Edgy', value: 'edgy' },
  { label: 'Bohemian', value: 'bohemian' },
  { label: 'Sporty', value: 'sporty' },
  { label: 'Professional', value: 'professional' },
  { label: 'Random', value: 'random' },
];

const occupationOptions: PhotoOption[] = [
  { label: 'Student', value: 'student', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=300&h=300&fit=crop' },
  { label: 'Teacher', value: 'teacher', image: 'https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=300&h=300&fit=crop' },
  { label: 'Nurse', value: 'nurse', image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&h=300&fit=crop' },
  { label: 'Fitness trainer', value: 'fitness trainer', image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=300&h=300&fit=crop' },
  { label: 'Chef', value: 'chef', image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=300&h=300&fit=crop' },
  { label: 'Lawyer', value: 'lawyer', image: 'https://images.unsplash.com/photo-1589578527966-fdac0f44566c?w=300&h=300&fit=crop' },
  { label: 'Artist', value: 'artist', image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=300&h=300&fit=crop' },
  { label: 'Pilot', value: 'pilot', image: 'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=300&h=300&fit=crop' },
  { label: 'Doctor', value: 'doctor', image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=300&h=300&fit=crop' },
  { label: 'Model', value: 'model', image: 'https://images.unsplash.com/photo-1469460340997-2f854421e72f?w=300&h=300&fit=crop' },
  { label: 'Musician', value: 'musician', image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop' },
  { label: 'Random', value: 'random', icon: '🎲' },
];

const personalityOptions: EmojiOption[] = [
  { label: 'Warm & romantic', value: 'warm_romantic', icon: '❤️' },
  { label: 'Playful & teasing', value: 'playful_tease', icon: '😜' },
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
  'Bookworm',
  'Cat lover',
  'Dog lover',
  'Gamer',
  'Foodie',
  'Night owl',
  'Hopeless romantic',
  'Sarcastic humor',
  'Deep thinker',
];

const HAIR_COLOR_SWATCHES: Record<string, string> = {
  black: '#1a1a1a',
  'dark brown': '#3b2314',
  'light brown': '#a0724e',
  blonde: '#d4b87a',
  platinum: '#e8dcc8',
  auburn: '#6a2c1a',
  red: '#8b2500',
};

const EYE_COLOR_SWATCHES: Record<string, string> = {
  brown: '#6b3a2a',
  'dark brown': '#3b2314',
  blue: '#4a7ca8',
  green: '#4a7c4f',
  hazel: '#8e7540',
  amber: '#c88a2e',
};

const deriveTone = (personality: string): string => {
  const map: Record<string, string> = {
    warm_romantic: 'Warm & caring',
    playful_tease: 'Flirty & witty',
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
  };
  const key = `${styleVibe}_${personality}`.toLowerCase();
  return map[key] || 'Glam nightlife';
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
  const [state, setState] = useState<CreatorState>(initialState);
  const [generationStarted, setGenerationStarted] = useState(false);
  const [portraitsLoading, setPortraitsLoading] = useState(false);
  const [portraitCandidates, setPortraitCandidates] = useState<PortraitCandidate[]>([]);
  const [recoverableCompanionId, setRecoverableCompanionId] = useState<string | null>(null);
  const [activeDotIndex, setActiveDotIndex] = useState(0);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const step = STEPS[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

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
    if (step === 'breastSize' && state.sex === 'female' && !state.breastSize) return 'Choose breast size.';
    if (step === 'age' && !state.age) return 'Choose age.';
    if (step === 'styleVibe' && !state.styleVibe) return 'Choose style.';
    if (step === 'portrait' && !state.selectedPortraitImage) return 'Pick one portrait to continue.';
    if (step === 'occupation' && !state.occupation) return 'Choose occupation.';
    if (step === 'personality' && !state.personality) return 'Choose personality.';
    if (step === 'sexuality' && !state.sexuality) return 'Choose sexual preference.';
    return null;
  };

  const maybeGeneratePortraits = async () => {
    if (portraitCandidates.length > 0) return;
    setPortraitsLoading(true);
    setError(null);
    setConflictHelp(null);
    setRecoverableCompanionId(null);

    try {
      const response = await fetch('/api/virtual-girlfriend/portrait-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sex: state.sex,
          origin: state.origin,
          hairColor: state.hairColor,
          hairLength: state.hairLength,
          eyeColor: state.eyeColor,
          skinTone: deriveSkinTone(state.origin),
          bodyType: state.bodyType,
          age: state.age,
          styleVibe: state.styleVibe,
          personality: state.personality,
        }),
      });

      const body = (await response.json()) as { candidates?: PortraitCandidate[]; error?: string };
      if (!response.ok || !body.candidates?.length) throw new Error(body.error ?? 'Unable to generate portraits now.');
      setPortraitCandidates(body.candidates);
    } catch (candidateError) {
      setError(candidateError instanceof Error ? candidateError.message : 'Portrait generation failed.');
    } finally {
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
      await maybeGeneratePortraits();
    }
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);

    let prev = stepIndex - 1;
    if (STEPS[prev] === 'breastSize' && state.sex !== 'female') {
      prev -= 1;
    }
    prev = Math.max(0, prev);

    setError(null);
    setConflictHelp(null);
    setStepIndex(prev);
  };

  const handleOptionSelect = <K extends keyof CreatorState>(field: K, value: CreatorState[K]) => {
    setField(field, value);
    setError(null);
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = setTimeout(() => {
      void goNext();
    }, 400);
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

    const tone = deriveTone(state.personality);
    const affectionStyle = deriveAffectionStyle(state.personality);
    const archetype = deriveArchetype(state.personality, tone);
    const visualAesthetic = deriveVisualAesthetic(state.styleVibe, state.personality);
    const skinTone = deriveSkinTone(state.origin);

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

        const body = (await response.json()) as VirtualGirlfriendSetupResult;

        if (body.state === 'ready' || body.state === 'partial_success' || body.state === 'review_pending') {
          const destination = body.companionId ? `/virtual-girlfriend/profile?companionId=${body.companionId}` : '/virtual-girlfriend/profile';
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

  const isSubmitting = generationStarted || pending;
  const showContinue = step === 'name' || step === 'portrait';

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
                <h2 className={styles.stepTitle}>Choose gender</h2>
                <div className={styles.genderGrid}>
                  {sexOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.photoOptionCard} ${styles.genderCard} ${state.sex === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('sex', option.value)}
                    >
                      <img src={option.image} alt={option.label} className={styles.photoImage} />
                      <span className={styles.photoOverlay} />
                      <span className={styles.photoLabel}>{option.label}</span>
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
                <h2 className={styles.stepTitle}>Choose ethnicity</h2>
                <div className={styles.photoGridThree}>
                  {originOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.photoSquareCard} ${state.origin === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('origin', option.value)}
                    >
                      {option.image ? <img src={option.image} alt={option.label} className={styles.squareImage} /> : <span className={styles.iconOnly}>{option.icon}</span>}
                      <span className={styles.squareLabel}>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'hairColor' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose hair color</h2>
                <div className={styles.optionGridThree}>
                  {hairOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.hairColor === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('hairColor', option.value)}
                    >
                      <span
                        className={styles.swatchCircle}
                        style={
                          option.value === 'random'
                            ? { background: 'conic-gradient(#ff2e63, #c084fc, #60a5fa, #34d399, #f59e0b, #ff2e63)' }
                            : { backgroundColor: HAIR_COLOR_SWATCHES[option.value] ?? '#666' }
                        }
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'hairLength' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose hair length</h2>
                <div className={styles.optionGridFour}>
                  {hairLengthOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.hairLength === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('hairLength', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'eyeColor' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose eye color</h2>
                <div className={styles.optionGridThree}>
                  {eyeColorOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.eyeColor === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('eyeColor', option.value)}
                    >
                      <span
                        className={styles.dotCircle}
                        style={
                          option.value === 'random'
                            ? { background: 'conic-gradient(#ff2e63, #c084fc, #60a5fa, #34d399, #f59e0b, #ff2e63)' }
                            : { backgroundColor: EYE_COLOR_SWATCHES[option.value] ?? '#666' }
                        }
                      />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'bodyType' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose body type</h2>
                <div className={styles.optionGridThree}>
                  {bodyOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.bodyType === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('bodyType', option.value)}
                    >
                      <span className={styles.cardIcon}>◍</span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'breastSize' && state.sex === 'female' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose breast size</h2>
                <div className={styles.optionGridFour}>
                  {breastSizeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.breastSize === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('breastSize', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'age' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>How old?</h2>
                <div className={styles.optionGridFour}>
                  {ageOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.age === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('age', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'styleVibe' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose style</h2>
                <div className={styles.optionGridThree}>
                  {styleVibeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.textOptionCard} ${state.styleVibe === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('styleVibe', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'portrait' && (
              <div className={styles.stepContent}>
                {portraitsLoading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.loadingOrb} />
                    <h2 className={styles.stepTitle}>Creating {state.name || 'your companion'}&apos;s portrait</h2>
                    <p className={styles.loadingSubtext}>Picking the perfect look...</p>
                    <div className={styles.traitSummary}>
                      {state.sex ? <span className={styles.traitChip}>{state.sex === 'female' ? 'Female' : 'Male'}</span> : null}
                      {state.origin ? <span className={styles.traitChip}>{originOptions.find((o) => o.value === state.origin)?.label}</span> : null}
                      {state.hairColor ? <span className={styles.traitChip}>{state.hairColor} hair</span> : null}
                      {state.eyeColor ? <span className={styles.traitChip}>{state.eyeColor} eyes</span> : null}
                      {state.bodyType ? <span className={styles.traitChip}>{state.bodyType}</span> : null}
                      {state.age ? <span className={styles.traitChip}>Age {state.age}</span> : null}
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className={styles.stepTitle}>Pick the portrait</h2>
                    <div className={styles.carouselContainer}>
                      <div className={styles.carouselTrack} ref={carouselRef}>
                        {portraitCandidates.map((candidate) => (
                          <button
                            key={candidate.id}
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
                        {portraitCandidates.map((_, i) => (
                          <span key={i} className={`${styles.dot} ${i === activeDotIndex ? styles.dotActive : ''}`} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 'occupation' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose occupation</h2>
                <div className={styles.photoGridThree}>
                  {occupationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.photoSquareCard} ${state.occupation === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => handleOptionSelect('occupation', option.value)}
                    >
                      {option.image ? <img src={option.image} alt={option.label} className={styles.squareImage} /> : <span className={styles.iconOnly}>{option.icon}</span>}
                      <span className={styles.squareLabel}>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'personality' && (
              <div className={styles.stepContent}>
                <h2 className={styles.stepTitle}>Choose personality</h2>
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
                <h2 className={styles.stepTitle}>Sexual preference</h2>
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
                <h2 className={styles.stepTitle}>Any special details?</h2>
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
            {step === 'freeformDetails' ? (
              <button type="button" className={styles.createButton} onClick={submit} disabled={isSubmitting}>
                Create
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
};
