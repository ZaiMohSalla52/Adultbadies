'use client';

import { ReactNode, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  VIRTUAL_GIRLFRIEND_AFFECTION_STYLES,
  VIRTUAL_GIRLFRIEND_ARCHETYPES,
  VIRTUAL_GIRLFRIEND_TONES,
  VIRTUAL_GIRLFRIEND_VISUAL_AESTHETICS,
  type VirtualGirlfriendSetupResult,
} from '@/lib/virtual-girlfriend/types';

type BuilderStep =
  | 'sex'
  | 'name'
  | 'origin'
  | 'skinTone'
  | 'hair'
  | 'hairLength'
  | 'eyeColor'
  | 'body'
  | 'styleVibe'
  | 'age'
  | 'portrait'
  | 'occupation'
  | 'personality'
  | 'relationshipTone'
  | 'details'
  | 'review';

type PortraitCandidate = { id: string; imageDataUrl: string; prompt: string; label: string };

type SetupConflict = {
  companionName?: string;
  guidance?: string[];
  topFieldLabels?: string[];
  conflictAreas?: string[];
};

type VisualOption = { label: string; value: string; image: string };
type HairOption = { label: string; value: string; swatch: string; textureClassName: string };

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
  sexuality: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  visualAesthetic: string;
  freeformDetails: string;
  selectedPortraitPrompt: string;
  selectedPortraitImage: string;
};

const STEPS: BuilderStep[] = [
  'sex',
  'name',
  'origin',
  'skinTone',
  'hair',
  'hairLength',
  'eyeColor',
  'body',
  'styleVibe',
  'age',
  'portrait',
  'occupation',
  'personality',
  'relationshipTone',
  'details',
  'review',
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
  styleVibe: '',
  age: '',
  occupation: '',
  personality: '',
  sexuality: '',
  archetype: VIRTUAL_GIRLFRIEND_ARCHETYPES[0],
  tone: VIRTUAL_GIRLFRIEND_TONES[0],
  affectionStyle: VIRTUAL_GIRLFRIEND_AFFECTION_STYLES[0],
  visualAesthetic: VIRTUAL_GIRLFRIEND_VISUAL_AESTHETICS[0],
  freeformDetails: '',
  selectedPortraitPrompt: '',
  selectedPortraitImage: '',
};

const sexOptions: VisualOption[] = [
  {
    label: 'Female',
    value: 'female',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Male',
    value: 'male',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
  },
];

const originOptions: VisualOption[] = [
  { label: 'East Asian', value: 'asian', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80' },
  { label: 'Latina', value: 'latina', image: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?auto=format&fit=crop&w=900&q=80' },
  { label: 'Black / African', value: 'black', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
  { label: 'Caucasian / White', value: 'white', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { label: 'Mixed', value: 'mixed', image: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=900&q=80' },
  { label: 'Middle Eastern', value: 'middle_eastern', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1615109398623-88346a601842?auto=format&fit=crop&w=900&q=80' },
];

const hairOptions: HairOption[] = [
  { label: 'Black', value: 'black', swatch: '#101014', textureClassName: 'hair-jet-black' },
  { label: 'Dark brown', value: 'dark brown', swatch: '#3a2517', textureClassName: 'hair-dark-brown' },
  { label: 'Light brown', value: 'light brown', swatch: '#7a5135', textureClassName: 'hair-light-brown' },
  { label: 'Blonde', value: 'blonde', swatch: '#d7b56c', textureClassName: 'hair-blonde' },
  { label: 'Platinum', value: 'platinum', swatch: '#dadde5', textureClassName: 'hair-platinum' },
  { label: 'Auburn', value: 'auburn', swatch: '#8d3f23', textureClassName: 'hair-auburn' },
  { label: 'Red', value: 'red', swatch: '#b7422d', textureClassName: 'hair-red' },
  { label: 'Silver', value: 'silver', swatch: '#a8afb9', textureClassName: 'hair-silver' },
  { label: 'Random', value: 'random', swatch: '#6366f1', textureClassName: 'hair-random' },
];

const bodyOptions: VisualOption[] = [
  { label: 'Slim', value: 'slim', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80' },
  { label: 'Petite', value: 'petite', image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80' },
  { label: 'Athletic', value: 'athletic', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80' },
  { label: 'Curvy', value: 'curvy', image: 'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80' },
  { label: 'Plus size', value: 'plus size', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80' },
];

const hairLengthOptions: VisualOption[] = [
  { label: 'Short', value: 'short', image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80' },
  { label: 'Medium', value: 'medium', image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80' },
  { label: 'Long', value: 'long', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=900&q=80' },
];

const eyeColorOptions: VisualOption[] = [
  { label: 'Brown', value: 'brown', image: 'https://images.unsplash.com/photo-1479936343636-73cdc5aae0c3?auto=format&fit=crop&w=900&q=80' },
  { label: 'Blue', value: 'blue', image: 'https://images.unsplash.com/photo-1546967191-fdfb13ed6b1e?auto=format&fit=crop&w=900&q=80' },
  { label: 'Green', value: 'green', image: 'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?auto=format&fit=crop&w=900&q=80' },
  { label: 'Hazel', value: 'hazel', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80' },
  { label: 'Dark brown', value: 'dark brown', image: 'https://images.unsplash.com/photo-1615109398623-88346a601842?auto=format&fit=crop&w=900&q=80' },
  { label: 'Amber', value: 'amber', image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80' },
];

const skinToneOptions: VisualOption[] = [
  { label: 'Fair', value: 'fair', image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80' },
  { label: 'Light', value: 'light', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { label: 'Medium', value: 'medium', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80' },
  { label: 'Tan', value: 'tan', image: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?auto=format&fit=crop&w=900&q=80' },
  { label: 'Dark', value: 'dark', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
  { label: 'Deep', value: 'deep', image: 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80' },
];

const styleVibeOptions: VisualOption[] = [
  { label: 'Casual everyday', value: 'casual', image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80' },
  { label: 'Professional / Elegant', value: 'elegant', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80' },
  { label: 'Streetwear / Edgy', value: 'edgy', image: 'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80' },
  { label: 'Bohemian / Natural', value: 'bohemian', image: 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=900&q=80' },
  { label: 'Sporty / Active', value: 'sporty', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80' },
];

const ageOptions: VisualOption[] = [
  { label: '18', value: '18', image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80' },
  { label: '21', value: '21', image: 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=900&q=80' },
  { label: '24', value: '24', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { label: '27', value: '27', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80' },
  { label: '30', value: '30', image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80' },
  { label: '35', value: '35', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', value: 'random', image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80' },
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

const optionCard = (option: VisualOption, selected: boolean, onSelect: () => void, extraClassName = '') => (
  <button key={`${option.label}-${option.value}`} type="button" className={`vg-option-card ${extraClassName} ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
    <div className="vg-option-card-media">
      <img src={option.image} alt={option.label} loading="lazy" className="vg-option-card-image" />
    </div>
    <span className="vg-option-card-label">{option.label}</span>
  </button>
);

const hairOptionCard = (option: HairOption, selected: boolean, onSelect: () => void) => (
  <button key={option.label} type="button" className={`vg-option-card ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
    <div className="vg-option-card-media">
      <div className={`vg-hair-texture ${option.textureClassName}`} aria-hidden="true" />
    </div>
    <span className="vg-option-card-label vg-hair-label-wrap">
      <span className="vg-hair-swatch" style={{ backgroundColor: option.swatch }} aria-hidden="true" />
      <span>{option.label}</span>
    </span>
  </button>
);

const getOptionLabel = (options: Array<{ value: string; label: string }>, value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

const StepPanel = ({ title, subtitle, children, rich = false }: { title: string; subtitle?: string; children: ReactNode; rich?: boolean }) => (
  <section className={`vg-step-panel ${rich ? 'is-rich' : ''}`}>
    <div className="vg-step-heading">
      <h1 className="vg-step-title">{title}</h1>
      {subtitle ? <p className="vg-step-support my-0">{subtitle}</p> : null}
    </div>
    {children}
  </section>
);

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
    if (step === 'origin' && !state.origin) return 'Choose origin.';
    if (step === 'skinTone' && !state.skinTone) return 'Choose skin tone.';
    if (step === 'hair' && !state.hairColor) return 'Choose hair color.';
    if (step === 'hairLength' && !state.hairLength) return 'Choose hair length.';
    if (step === 'eyeColor' && !state.eyeColor) return 'Choose eye color.';
    if (step === 'body' && !state.bodyType) return 'Choose body type.';
    if (step === 'styleVibe' && !state.styleVibe) return 'Choose style vibe.';
    if (step === 'age' && !state.age) return 'Choose age.';
    if (step === 'portrait' && !state.selectedPortraitImage) return 'Pick one portrait to continue.';
    if (step === 'occupation' && !state.occupation.trim()) return 'Occupation is required.';
    if (step === 'personality' && !state.personality) return 'Choose personality.';
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
            freeformDetails: state.freeformDetails,
            preferenceHints: state.freeformDetails,
            archetype: state.archetype,
            tone: state.tone,
            affectionStyle: state.affectionStyle,
            visualAesthetic: state.visualAesthetic,
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
  const portraitContinueDisabled = step === 'portrait' && (!state.selectedPortraitImage || portraitsLoading);

  const generationSummary = [
    { label: 'Name', value: state.name },
    { label: 'Origin', value: getOptionLabel(originOptions, state.origin) },
    { label: 'Skin tone', value: getOptionLabel(skinToneOptions, state.skinTone) },
    { label: 'Hair', value: getOptionLabel(hairOptions, state.hairColor) },
    { label: 'Hair length', value: getOptionLabel(hairLengthOptions, state.hairLength) },
    { label: 'Eyes', value: getOptionLabel(eyeColorOptions, state.eyeColor) },
    { label: 'Body', value: getOptionLabel(bodyOptions, state.bodyType) },
    { label: 'Style', value: getOptionLabel(styleVibeOptions, state.styleVibe) },
    { label: 'Age', value: state.age },
    { label: 'Occupation', value: state.occupation },
  ].filter((item) => item.value);

  const reviewChips = [
    state.name,
    state.sex,
    getOptionLabel(originOptions, state.origin),
    getOptionLabel(skinToneOptions, state.skinTone),
    getOptionLabel(hairOptions, state.hairColor),
    getOptionLabel(hairLengthOptions, state.hairLength),
    getOptionLabel(eyeColorOptions, state.eyeColor),
    getOptionLabel(bodyOptions, state.bodyType),
    getOptionLabel(styleVibeOptions, state.styleVibe),
    state.age,
    state.occupation,
    state.personality,
    state.affectionStyle,
    state.tone,
  ].filter(Boolean);

  return (
    <div className="app-page-stack">
      <Card className={`vg-stage-card ${step === 'review' ? 'is-review-step' : ''}`}>
        <div className="vg-stage-topbar">
          <Button variant="ghost" type="button" disabled={stepIndex === 0 || isSubmitting} onClick={() => setStepIndex((v) => Math.max(0, v - 1))}>
            Back
          </Button>
          <p className="my-0 text-xs text-muted">{stepIndex + 1}/{STEPS.length}</p>
          <Button variant="ghost" type="button" disabled={isSubmitting} onClick={() => router.push('/virtual-girlfriend')}>
            Close
          </Button>
        </div>
        <div className="vg-stage-progress-track"><div className="vg-stage-progress-fill" style={{ width: `${progress}%` }} /></div>

        {isSubmitting ? (
          <div className="vg-generation-state" role="status" aria-live="polite">
            <div className="vg-generation-orb" aria-hidden="true" />
            <h2 className="my-0">Creating {state.name} …</h2>
            <p className="my-0 text-sm text-muted">Building profile, photos, and memory setup</p>
            <div className="vg-generation-summary-card">
              {generationSummary.map((item) => (
                <div key={item.label} className="vg-generation-summary-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {step === 'sex' ? (
              <StepPanel title="Choose a sex" subtitle="Pick the companion lane you want to build.">
                <div className="vg-option-group vg-option-group--small">{sexOptions.map((option) => optionCard(option, state.sex === option.value, () => setField('sex', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'name' ? (
              <StepPanel title="What is the name?" subtitle="This will be used for profile and chat identity.">
                <Input name="name" placeholder="Enter name" maxLength={40} value={state.name} onChange={(event) => setField('name', event.target.value)} required />
              </StepPanel>
            ) : null}

            {step === 'origin' ? (
              <StepPanel title="Choose origin" subtitle="Set a foundational visual direction.">
                <div className="vg-option-group vg-option-group--medium">{originOptions.map((option) => optionCard(option, state.origin === option.value, () => setField('origin', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'skinTone' ? (
              <StepPanel title="Choose skin tone" subtitle="Set complexion direction for visuals.">
                <div className="vg-option-group vg-option-group--medium">{skinToneOptions.map((option) => optionCard(option, state.skinTone === option.value, () => setField('skinTone', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'hair' ? (
              <StepPanel title="Choose hair color" subtitle="Keep it tight and intentional.">
                <div className="vg-option-group vg-option-group--medium">{hairOptions.map((option) => hairOptionCard(option, state.hairColor === option.value, () => setField('hairColor', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'hairLength' ? (
              <StepPanel title="Choose hair length" subtitle="Pick the overall hair length.">
                <div className="vg-option-group vg-option-group--medium">{hairLengthOptions.map((option) => optionCard(option, state.hairLength === option.value, () => setField('hairLength', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'eyeColor' ? (
              <StepPanel title="Choose eye color" subtitle="Select the primary eye color.">
                <div className="vg-option-group vg-option-group--medium">{eyeColorOptions.map((option) => optionCard(option, state.eyeColor === option.value, () => setField('eyeColor', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'body' ? (
              <StepPanel title="Choose body type" subtitle="Select the body silhouette.">
                <div className="vg-option-group vg-option-group--medium">{bodyOptions.map((option) => optionCard(option, state.bodyType === option.value, () => setField('bodyType', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'styleVibe' ? (
              <StepPanel title="Choose style / vibe" subtitle="Define wardrobe and fashion direction.">
                <div className="vg-option-group vg-option-group--medium">{styleVibeOptions.map((option) => optionCard(option, state.styleVibe === option.value, () => setField('styleVibe', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'age' ? (
              <StepPanel title="Choose age" subtitle="Set age expression for generation.">
                <div className="vg-option-group vg-option-group--medium">{ageOptions.map((option) => optionCard(option, state.age === option.value, () => setField('age', option.value)))}</div>
              </StepPanel>
            ) : null}

            {step === 'portrait' ? (
              <StepPanel title="Pick face identity" subtitle="Choose one portrait candidate to lock in." rich>
                {portraitsLoading ? (
                  <div className="vg-portrait-loading-state">
                    <div className="vg-portrait-loading-orb" aria-hidden="true" />
                    <p className="my-0 text-sm text-muted">Generating portrait candidates…</p>
                  </div>
                ) : (
                  <div className="vg-option-group vg-option-group--portrait">
                    {portraitCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`vg-option-card vg-option-card--portrait ${state.selectedPortraitImage === candidate.imageDataUrl ? 'is-selected' : ''}`}
                        onClick={() => {
                          setField('selectedPortraitPrompt', candidate.prompt);
                          setField('selectedPortraitImage', candidate.imageDataUrl);
                        }}
                      >
                        <div className="vg-option-card-media">
                          <img src={candidate.imageDataUrl} alt={candidate.label} className="vg-option-card-image" />
                        </div>
                        <span className="vg-option-card-label">{candidate.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </StepPanel>
            ) : null}

            {step === 'occupation' ? (
              <StepPanel title="Choose occupation" subtitle="Add the role that grounds personality.">
                <Input className="vg-occupation-input" name="occupation" placeholder="Occupation" maxLength={80} value={state.occupation} onChange={(event) => setField('occupation', event.target.value)} />
              </StepPanel>
            ) : null}

            {step === 'personality' ? (
              <StepPanel title="Choose personality" subtitle="Select one dominant mode.">
                <div className="vg-chip-grid">
                  {personalityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`vg-chip ${state.personality === option.value ? 'is-selected' : ''}`}
                      onClick={() => setField('personality', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </StepPanel>
            ) : null}

            {step === 'relationshipTone' ? (
              <StepPanel title="Set relationship vibe and tone" subtitle="Tune emotional style and conversation energy.">
                <div className="vg-select-stack">
                  <label>Relationship vibe</label>
                  <select value={state.affectionStyle} onChange={(event) => setField('affectionStyle', event.target.value)}>
                    {VIRTUAL_GIRLFRIEND_AFFECTION_STYLES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <label>Tone</label>
                  <select value={state.tone} onChange={(event) => setField('tone', event.target.value)}>
                    {VIRTUAL_GIRLFRIEND_TONES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </StepPanel>
            ) : null}

            {step === 'details' ? (
              <StepPanel title="Personal details" subtitle="Optional preferences, habits, and boundaries.">
                <Textarea name="freeformDetails" placeholder="Likes, habits, boundaries, notes..." rows={6} maxLength={400} value={state.freeformDetails} onChange={(event) => setField('freeformDetails', event.target.value)} />
              </StepPanel>
            ) : null}

            {step === 'review' ? (
              <StepPanel title="Review and generate" subtitle="Final check before creating your companion." rich>
                <div className="vg-review-layout">
                  <div className="vg-review-portrait-frame">
                    <img src={state.selectedPortraitImage} alt="Selected portrait" className="vg-review-portrait" />
                  </div>
                  <div className="vg-review-content">
                    <h2 className="my-0">{state.name || 'Your companion'}</h2>
                    <p className="my-0 text-sm text-muted">Profile settings are locked in and ready for generation.</p>
                    <div className="vg-review-pills">
                      {reviewChips.map((chip) => (
                        <span key={chip}>{chip}</span>
                      ))}
                    </div>
                    <Button type="button" className="vg-review-generate-btn" onClick={submit} disabled={isSubmitting}>Generate Companion</Button>
                  </div>
                </div>
              </StepPanel>
            ) : null}

            {error ? <p className="onboarding-error my-0">{error}</p> : null}
            {recoverableCompanionId ? (
              <div className="vg-step-actions">
                <Button type="button" variant="secondary" onClick={() => router.push(`/virtual-girlfriend/profile?companionId=${recoverableCompanionId}`)}>
                  Open created profile
                </Button>
              </div>
            ) : null}
            {conflictHelp ? (
              <div className="rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-sm text-rose-100">
                <p className="my-0 font-semibold">Too close to {conflictHelp.companionName ?? 'an existing companion'}.</p>
                {conflictHelp.topFieldLabels?.length ? <p className="my-2">Most overlapping areas: {conflictHelp.topFieldLabels.slice(0, 3).join(', ')}.</p> : null}
                <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
                  {(conflictHelp.guidance?.length ? conflictHelp.guidance : ['Try changing appearance, personality, or relationship vibe.']).map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {step !== 'review' ? (
              <div className="vg-step-actions">
                <Button type="button" onClick={goNext} disabled={portraitContinueDisabled}>Continue</Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
};
