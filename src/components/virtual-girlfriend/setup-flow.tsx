'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  VIRTUAL_GIRLFRIEND_AFFECTION_STYLES,
  VIRTUAL_GIRLFRIEND_TONES,
  type VirtualGirlfriendSetupResult,
} from '@/lib/virtual-girlfriend/types';
import styles from './setup-flow.module.css';

type BuilderStep =
  | 'gender'
  | 'name'
  | 'ethnicitySkin'
  | 'hair'
  | 'eyesBody'
  | 'styleAge'
  | 'portrait'
  | 'personality'
  | 'details';

type PortraitCandidate = { id: string; imageDataUrl: string; prompt: string; label: string };

type SetupConflict = {
  companionName?: string;
  guidance?: string[];
  topFieldLabels?: string[];
  conflictAreas?: string[];
};

type VisualOption = { label: string; value: string; image: string };

type CreatorState = {
  name: string;
  sex: string;
  origin: string;
  skinTone: string;
  hairColor: string;
  hairLength: string;
  eyeColor: string;
  bodyType: string;
  styleVibe: string;
  age: string;
  occupation: string;
  personality: string;
  tone: string;
  affectionStyle: string;
  freeformDetails: string;
  selectedPortraitPrompt: string;
  selectedPortraitImage: string;
};

const STEPS: BuilderStep[] = ['gender', 'name', 'ethnicitySkin', 'hair', 'eyesBody', 'styleAge', 'portrait', 'personality', 'details'];

const initialState: CreatorState = {
  name: '',
  sex: 'female',
  origin: '',
  skinTone: '',
  hairColor: '',
  hairLength: '',
  eyeColor: '',
  bodyType: '',
  styleVibe: '',
  age: '',
  occupation: '',
  personality: '',
  tone: VIRTUAL_GIRLFRIEND_TONES[0],
  affectionStyle: VIRTUAL_GIRLFRIEND_AFFECTION_STYLES[0],
  freeformDetails: '',
  selectedPortraitPrompt: '',
  selectedPortraitImage: '',
};

const sexOptions: VisualOption[] = [
  {
    label: 'Male',
    value: 'male',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&crop=face',
  },
  {
    label: 'Female',
    value: 'female',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&crop=face',
  },
];

const originOptions: VisualOption[] = [
  { label: 'East Asian', value: 'asian', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80' },
  { label: 'Latina', value: 'latina', image: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?auto=format&fit=crop&w=900&q=80' },
  { label: 'Black / African', value: 'black', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
  { label: 'Caucasian / White', value: 'white', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { label: 'Mixed', value: 'mixed', image: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=900&q=80' },
  { label: 'Middle Eastern', value: 'middle_eastern', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80' },
  { label: 'South Asian', value: 'south_asian', image: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1615109398623-88346a601842?auto=format&fit=crop&w=900&q=80' },
];

const hairOptions = [
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

const bodyOptions = [
  { label: 'Slim', value: 'slim' },
  { label: 'Petite', value: 'petite' },
  { label: 'Athletic', value: 'athletic' },
  { label: 'Curvy', value: 'curvy' },
  { label: 'Plus size', value: 'plus size' },
  { label: 'Random', value: 'random' },
];

const hairLengthOptions = [
  { label: 'Short', value: 'short' },
  { label: 'Medium', value: 'medium' },
  { label: 'Long', value: 'long' },
  { label: 'Random', value: 'random' },
];

const eyeColorOptions = [
  { label: 'Brown', value: 'brown' },
  { label: 'Blue', value: 'blue' },
  { label: 'Green', value: 'green' },
  { label: 'Hazel', value: 'hazel' },
  { label: 'Dark brown', value: 'dark brown' },
  { label: 'Amber', value: 'amber' },
  { label: 'Random', value: 'random' },
];

const skinToneOptions = [
  { label: 'Fair', value: 'fair' },
  { label: 'Light', value: 'light' },
  { label: 'Medium', value: 'medium' },
  { label: 'Tan', value: 'tan' },
  { label: 'Dark', value: 'dark' },
  { label: 'Deep', value: 'deep' },
  { label: 'Random', value: 'random' },
];

const styleVibeOptions = [
  { label: 'Casual everyday', value: 'casual' },
  { label: 'Professional / Elegant', value: 'elegant' },
  { label: 'Streetwear / Edgy', value: 'edgy' },
  { label: 'Bohemian / Natural', value: 'bohemian' },
  { label: 'Sporty / Active', value: 'sporty' },
  { label: 'Random', value: 'random' },
];

const ageOptions = [
  { label: '18', value: '18' },
  { label: '21', value: '21' },
  { label: '24', value: '24' },
  { label: '27', value: '27' },
  { label: '30', value: '30' },
  { label: '35', value: '35' },
  { label: 'Random', value: 'random' },
];

const personalityOptions = [
  { label: 'Warm & romantic', value: 'warm_romantic' },
  { label: 'Playful & teasing', value: 'playful_tease' },
  { label: 'Confident & bold', value: 'confident_bold' },
  { label: 'Intellectual & deep', value: 'intellectual' },
  { label: 'Sweet & caring', value: 'sweet_caring' },
  { label: 'Sarcastic & witty', value: 'sarcastic_witty' },
  { label: 'Mysterious & intense', value: 'mysterious' },
  { label: 'Bubbly & energetic', value: 'bubbly_energetic' },
];

const HAIR_COLOR_SWATCHES: Record<string, string> = {
  black: '#1a1a1a',
  'dark brown': '#3b2314',
  'light brown': '#a0724e',
  blonde: '#d4b87a',
  platinum: '#e8dcc8',
  red: '#8b2500',
  auburn: '#6a2c1a',
  ginger: '#c45a28',
  gray: '#8a8a8a',
  silver: '#8a8a8a',
  white: '#e0e0e0',
  random: '#E8467C',
};

const EYE_COLOR_SWATCHES: Record<string, string> = {
  brown: '#6b3a2a',
  'dark brown': '#3b2314',
  hazel: '#8e7540',
  green: '#4a7c4f',
  blue: '#4a7ca8',
  gray: '#8a9aa0',
  amber: '#c88a2e',
  black: '#1a1a1a',
  random: '#E8467C',
};

const SKIN_TONE_SWATCHES: Record<string, string> = {
  fair: '#f5d6c3',
  light: '#e8c4a8',
  medium: '#c4956a',
  tan: '#a67c52',
  olive: '#8b7355',
  brown: '#7a5a3a',
  dark: '#5a3a22',
  deep: '#3d2614',
  random: '#E8467C',
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

  const step = STEPS[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  const setField = <K extends keyof CreatorState>(key: K, value: CreatorState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const validateCurrentStep = (): string | null => {
    if (step === 'name' && !state.name.trim()) return 'Name is required.';
    if (step === 'ethnicitySkin' && (!state.origin || !state.skinTone)) return 'Choose ethnicity and skin tone.';
    if (step === 'hair' && (!state.hairColor || !state.hairLength)) return 'Choose hair color and length.';
    if (step === 'eyesBody' && (!state.eyeColor || !state.bodyType)) return 'Choose eye color and body type.';
    if (step === 'styleAge' && (!state.styleVibe || !state.age)) return 'Choose style vibe and age.';
    if (step === 'portrait' && !state.selectedPortraitImage) return 'Pick one portrait to continue.';
    if (step === 'personality' && (!state.personality || !state.occupation.trim() || !state.tone || !state.affectionStyle)) {
      return 'Complete personality, occupation, tone, and affection style.';
    }
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
          skinTone: state.skinTone,
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

    const next = Math.min(STEPS.length - 1, stepIndex + 1);
    setError(null);
    setConflictHelp(null);
    setStepIndex(next);

    if (STEPS[next] === 'portrait') {
      await maybeGeneratePortraits();
    }
  };

  const submit = () => {
    if (!state.name.trim() || !state.selectedPortraitImage || !state.selectedPortraitPrompt) {
      setError('Complete required steps before generating.');
      return;
    }

    const archetype = deriveArchetype(state.personality, state.tone);
    const visualAesthetic = deriveVisualAesthetic(state.styleVibe, state.personality);

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
            skinTone: state.skinTone,
            bodyType: state.bodyType,
            styleVibe: state.styleVibe,
            occupation: state.occupation,
            personality: state.personality,
            affectionStyle: state.affectionStyle,
            tone: state.tone,
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
  const continueDisabled = isSubmitting || portraitsLoading || Boolean(validateCurrentStep());

  return (
    <div className={styles.creatorContainer}>
      <div className={styles.progressBar} aria-hidden="true">
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      {isSubmitting && (
        <div className={styles.generatingState}>
          <div className={styles.generatingOrb} />
          <h2 className={styles.generatingTitle}>Creating {state.name || 'your companion'}…</h2>
          <p className={styles.generatingSubtext}>Building profile, photos, and memory setup</p>
        </div>
      )}

      {!isSubmitting && (
        <>
      <div className={styles.stepTransition} key={step}>
        {step === 'gender' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Choose gender</h2>
            <div className={`${styles.optionGrid} ${styles.genderGrid}`}>
              {sexOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.optionCard} ${styles.sexCard} ${state.sex === option.value ? styles.optionCardSelected : ''}`}
                  onClick={() => setField('sex', option.value)}
                >
                  <img src={option.image} alt={option.label} className={styles.sexImage} />
                  <span className={styles.sexOverlay} />
                  <span className={styles.sexLabel}>{option.label}</span>
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
              placeholder="Enter companion name"
              maxLength={40}
              value={state.name}
              onChange={(event) => setField('name', event.target.value)}
            />
          </div>
        )}

        {step === 'ethnicitySkin' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Choose their look</h2>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Ethnicity</label>
              <div className={styles.optionGrid}>
                {originOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.origin === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('origin', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Skin tone</label>
              <div className={styles.optionGrid}>
                {skinToneOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.skinTone === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('skinTone', option.value)}
                  >
                    <span className={styles.colorSwatch} style={{ backgroundColor: SKIN_TONE_SWATCHES[option.value] || '#666' }} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'hair' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Choose their hair</h2>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Color</label>
              <div className={styles.optionGrid}>
                {hairOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.hairColor === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('hairColor', option.value)}
                  >
                    <span className={styles.colorSwatch} style={{ backgroundColor: HAIR_COLOR_SWATCHES[option.value] || '#666' }} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Length</label>
              <div className={`${styles.optionGrid} ${styles.lengthGrid}`}>
                {hairLengthOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.hairLength === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('hairLength', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'eyesBody' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Eyes & body type</h2>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Eye color</label>
              <div className={styles.optionGrid}>
                {eyeColorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.eyeColor === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('eyeColor', option.value)}
                  >
                    <span className={styles.colorSwatch} style={{ backgroundColor: EYE_COLOR_SWATCHES[option.value] || '#666' }} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Body type</label>
              <div className={styles.optionGrid}>
                {bodyOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.bodyType === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('bodyType', option.value)}
                  >
                    <span className={styles.iconHint} aria-hidden="true">◍</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'styleAge' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Style & age</h2>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Style vibe</label>
              <div className={styles.optionGrid}>
                {styleVibeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.styleVibe === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('styleVibe', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Age</label>
              <div className={`${styles.optionGrid} ${styles.compactGrid}`}>
                {ageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.optionCard} ${state.age === option.value ? styles.optionCardSelected : ''}`}
                    onClick={() => setField('age', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'portrait' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Choose their look</h2>
            {portraitsLoading ? (
              <div className={styles.portraitGrid}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={styles.portraitSkeleton} />
                ))}
                <p className={styles.loadingText}>Generating your companion...</p>
              </div>
            ) : (
              <div className={styles.portraitGrid}>
                {portraitCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`${styles.portraitCard} ${state.selectedPortraitImage === candidate.imageDataUrl ? styles.portraitSelected : ''}`}
                    onClick={() => {
                      setField('selectedPortraitPrompt', candidate.prompt);
                      setField('selectedPortraitImage', candidate.imageDataUrl);
                    }}
                  >
                    <img src={candidate.imageDataUrl} alt={candidate.label} className={styles.portraitImage} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'personality' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Shape their personality</h2>
            <div className={styles.twoColumn}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Personality</label>
                <div className={`${styles.optionGrid} ${styles.compactGrid}`}>
                  {personalityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.optionCard} ${styles.chipCard} ${state.personality === option.value ? styles.optionCardSelected : ''}`}
                      onClick={() => setField('personality', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Occupation</label>
                <input
                  className={styles.textInput}
                  placeholder="Enter occupation"
                  maxLength={80}
                  value={state.occupation}
                  onChange={(event) => setField('occupation', event.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Conversation style</label>
                <div className={`${styles.optionGrid} ${styles.compactGrid}`}>
                  {VIRTUAL_GIRLFRIEND_TONES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${styles.optionCard} ${styles.chipCard} ${state.tone === option ? styles.optionCardSelected : ''}`}
                      onClick={() => setField('tone', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Affection style</label>
                <div className={`${styles.optionGrid} ${styles.compactGrid}`}>
                  {VIRTUAL_GIRLFRIEND_AFFECTION_STYLES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${styles.optionCard} ${styles.chipCard} ${state.affectionStyle === option ? styles.optionCardSelected : ''}`}
                      onClick={() => setField('affectionStyle', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'details' && (
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
          </div>
        )}
      </div>

      {error ? <p className={styles.errorText}>{error}</p> : null}
      {recoverableCompanionId ? (
        <button type="button" className={styles.backButton} onClick={() => router.push(`/virtual-girlfriend/profile?companionId=${recoverableCompanionId}`)}>
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
        <button
          type="button"
          className={styles.backButton}
          disabled={stepIndex === 0 || isSubmitting}
          onClick={() => setStepIndex((v) => Math.max(0, v - 1))}
        >
          Back
        </button>
        {step !== 'details' ? (
          <button type="button" className={styles.continueButton} onClick={goNext} disabled={continueDisabled}>
            Continue
          </button>
        ) : (
          <button type="button" className={styles.createButton} onClick={submit} disabled={isSubmitting}>
            Create
          </button>
        )}
      </div>
        </>
      )}
    </div>
  );
};
