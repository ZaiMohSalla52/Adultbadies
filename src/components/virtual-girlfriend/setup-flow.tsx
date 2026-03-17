'use client';

import { useMemo, useState, useTransition } from 'react';
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
} from '@/lib/virtual-girlfriend/types';

type BuilderStep =
  | 'sex'
  | 'name'
  | 'origin'
  | 'hair'
  | 'body'
  | 'age'
  | 'portrait'
  | 'occupation'
  | 'personality'
  | 'sexuality'
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

type VisualOption = { label: string; image: string; cardClassName?: string; imageClassName?: string };
type HairOption = { label: string; swatch: string; textureClassName: string };

type CreatorState = {
  name: string;
  sex: string;
  origin: string;
  hairColor: string;
  figure: string;
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
  'hair',
  'body',
  'age',
  'portrait',
  'occupation',
  'personality',
  'sexuality',
  'relationshipTone',
  'details',
  'review',
];

const initialState: CreatorState = {
  name: '',
  sex: 'Female',
  origin: '',
  hairColor: '',
  figure: '',
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
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  },
  {
    label: 'Male',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
  },
];

const originOptions: VisualOption[] = [
  { label: 'Africa', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
  { label: 'Caucasian', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { label: 'Indian', image: 'https://images.unsplash.com/photo-1615109398623-88346a601842?auto=format&fit=crop&w=900&q=80' },
  { label: 'Latina', image: 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?auto=format&fit=crop&w=900&q=80' },
  { label: 'Asian', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80' },
  { label: 'Arab', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', image: 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=900&q=80' },
];

const hairOptions: HairOption[] = [
  { label: 'Jet black', swatch: '#101014', textureClassName: 'hair-jet-black' },
  { label: 'Dark brown', swatch: '#3a2517', textureClassName: 'hair-dark-brown' },
  { label: 'Light brown', swatch: '#7a5135', textureClassName: 'hair-light-brown' },
  { label: 'Blonde', swatch: '#d7b56c', textureClassName: 'hair-blonde' },
  { label: 'Platinum', swatch: '#dadde5', textureClassName: 'hair-platinum' },
  { label: 'Auburn', swatch: '#8d3f23', textureClassName: 'hair-auburn' },
  { label: 'Red', swatch: '#b7422d', textureClassName: 'hair-red' },
  { label: 'Silver', swatch: '#a8afb9', textureClassName: 'hair-silver' },
  { label: 'Random', swatch: '#6366f1', textureClassName: 'hair-random' },
];

const bodyOptions: VisualOption[] = [
  { label: 'Slim', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80', cardClassName: 'vg-body-choice-card', imageClassName: 'vg-body-choice-image' },
  { label: 'Petite', image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80', cardClassName: 'vg-body-choice-card', imageClassName: 'vg-body-choice-image' },
  { label: 'Athletic', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80', cardClassName: 'vg-body-choice-card', imageClassName: 'vg-body-choice-image' },
  { label: 'Curvy', image: 'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80', cardClassName: 'vg-body-choice-card', imageClassName: 'vg-body-choice-image' },
  { label: 'Chubby', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80', cardClassName: 'vg-body-choice-card', imageClassName: 'vg-body-choice-image' },
  { label: 'Random', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80', cardClassName: 'vg-body-choice-card', imageClassName: 'vg-body-choice-image' },
];

const ageOptions: VisualOption[] = [
  { label: '18', image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80' },
  { label: '21', image: 'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?auto=format&fit=crop&w=900&q=80' },
  { label: '24', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80' },
  { label: '27', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80' },
  { label: '30', image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80' },
  { label: '35', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80' },
  { label: 'Random', image: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80' },
];

const personalityOptions = ['Warm romantic', 'Playful tease', 'Confident', 'Intellectual', 'Calm sweetheart'];
const sexualityOptions = ['Straight', 'Bisexual', 'Pansexual', 'Fluid'];

const optionCard = (option: VisualOption, selected: boolean, onSelect: () => void, variantClassName = '') => (
  <button
    key={option.label}
    type="button"
    className={`vg-image-choice-card ${variantClassName} ${option.cardClassName ?? ''} ${selected ? 'is-selected' : ''}`}
    onClick={onSelect}
  >
    <img src={option.image} alt={option.label} loading="lazy" className={option.imageClassName} />
    <span>{option.label}</span>
  </button>
);

const hairOptionCard = (option: HairOption, selected: boolean, onSelect: () => void) => (
  <button
    key={option.label}
    type="button"
    className={`vg-image-choice-card vg-hair-choice-card ${selected ? 'is-selected' : ''}`}
    onClick={onSelect}
  >
    <div className={`vg-hair-texture ${option.textureClassName}`} aria-hidden="true" />
    <span className="vg-hair-label-wrap">
      <span className="vg-hair-swatch" style={{ backgroundColor: option.swatch }} aria-hidden="true" />
      <span>{option.label}</span>
    </span>
  </button>
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

  const step = STEPS[stepIndex];
  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  const setField = <K extends keyof CreatorState>(key: K, value: CreatorState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const validateCurrentStep = (): string | null => {
    if (step === 'name' && !state.name.trim()) return 'Name is required.';
    if (step === 'origin' && !state.origin) return 'Choose origin.';
    if (step === 'hair' && !state.hairColor) return 'Choose hair color.';
    if (step === 'body' && !state.figure) return 'Choose body type.';
    if (step === 'age' && !state.age) return 'Choose age.';
    if (step === 'portrait' && !state.selectedPortraitImage) return 'Pick one portrait to continue.';
    if (step === 'occupation' && !state.occupation.trim()) return 'Occupation is required.';
    if (step === 'personality' && !state.personality) return 'Choose personality.';
    if (step === 'sexuality' && !state.sexuality) return 'Choose sexuality.';
    return null;
  };

  const maybeGeneratePortraits = async () => {
    if (portraitCandidates.length > 0) return;
    setPortraitsLoading(true);
    setError(null);
    setConflictHelp(null);

    try {
      const response = await fetch('/api/virtual-girlfriend/portrait-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sex: state.sex,
          origin: state.origin,
          hairColor: state.hairColor,
          figure: state.figure,
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
            figure: state.figure,
            occupation: state.occupation,
            personality: state.personality,
            sexuality: state.sexuality,
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

        const body = (await response.json()) as { error?: string; companionId?: string; conflict?: SetupConflict };
        if (!response.ok) {
          if (response.status === 409) {
            setError(body.error ?? 'Generation did not start because this setup is too similar to an existing companion.');
            setConflictHelp(body.conflict ?? null);
          } else if (response.status === 400) {
            setError(body.error ?? 'Please complete the setup fields and try again.');
            setConflictHelp(null);
          } else {
            setError(body.error ?? 'Server error while creating your companion setup.');
            setConflictHelp(null);
          }
          setGenerationStarted(false);
          setStepIndex(STEPS.length - 1);
          return;
        }

        const destination = body.companionId ? `/virtual-girlfriend/profile?companionId=${body.companionId}` : '/virtual-girlfriend/profile';
        router.push(destination);
        router.refresh();
      } catch {
        setError('Unable to submit setup right now. Generation has not started yet. Please try again.');
        setConflictHelp(null);
        setGenerationStarted(false);
      }
    });
  };

  const isSubmitting = generationStarted || pending;
  const portraitContinueDisabled = step === 'portrait' && (!state.selectedPortraitImage || portraitsLoading);

  const generationSummary = [
    { label: 'Name', value: state.name },
    { label: 'Origin', value: state.origin },
    { label: 'Hair', value: state.hairColor },
    { label: 'Body', value: state.figure },
    { label: 'Age', value: state.age },
    { label: 'Occupation', value: state.occupation },
  ].filter((item) => item.value);

  return (
    <div className="app-page-stack">
      <Card className="vg-stage-card">
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
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose a sex</h1>
                <div className="vg-hero-grid">{sexOptions.map((option) => optionCard(option, state.sex === option.label, () => setField('sex', option.label), 'vg-sex-choice-card'))}</div>
              </section>
            ) : null}

            {step === 'name' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">What is the name?</h1>
                <Input name="name" placeholder="Enter name" maxLength={40} value={state.name} onChange={(event) => setField('name', event.target.value)} required />
              </section>
            ) : null}

            {step === 'origin' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose origin</h1>
                <div className="vg-option-grid vg-origin-grid">{originOptions.map((option) => optionCard(option, state.origin === option.label, () => setField('origin', option.label), 'vg-origin-choice-card'))}</div>
              </section>
            ) : null}

            {step === 'hair' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose hair color</h1>
                <div className="vg-option-grid vg-hair-grid">{hairOptions.map((option) => hairOptionCard(option, state.hairColor === option.label, () => setField('hairColor', option.label)))}</div>
              </section>
            ) : null}

            {step === 'body' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose figure</h1>
                <div className="vg-option-grid vg-body-grid">{bodyOptions.map((option) => optionCard(option, state.figure === option.label, () => setField('figure', option.label), 'vg-body-choice-card'))}</div>
              </section>
            ) : null}

            {step === 'age' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose age</h1>
                <div className="vg-option-grid vg-age-grid">{ageOptions.map((option) => optionCard(option, state.age === option.label, () => setField('age', option.label), 'vg-age-choice-card'))}</div>
              </section>
            ) : null}

            {step === 'portrait' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Pick face identity</h1>
                {portraitsLoading ? (
                  <div className="vg-portrait-loading-state" role="status" aria-live="polite">
                    <div className="vg-portrait-loading-orb" aria-hidden="true" />
                    <p className="my-0 text-sm">Generating portraits…</p>
                    <p className="my-0 text-xs text-muted">Building face candidates from your selections</p>
                  </div>
                ) : (
                  <div className="vg-option-grid vg-portrait-grid">
                    {portraitCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`vg-image-choice-card vg-portrait-choice-card ${state.selectedPortraitImage === candidate.imageDataUrl ? 'is-selected' : ''}`}
                        onClick={() => {
                          setField('selectedPortraitPrompt', candidate.prompt);
                          setField('selectedPortraitImage', candidate.imageDataUrl);
                        }}
                      >
                        <img src={candidate.imageDataUrl} alt={candidate.label} />
                        <span>{candidate.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {step === 'occupation' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose occupation</h1>
                <Input
                  className="vg-occupation-input"
                  name="occupation"
                  placeholder="Occupation"
                  maxLength={80}
                  value={state.occupation}
                  onChange={(event) => setField('occupation', event.target.value)}
                />
              </section>
            ) : null}

            {step === 'personality' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose personality</h1>
                <div className="vg-chip-grid">
                  {personalityOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`vg-chip ${state.personality === option ? 'is-selected' : ''}`}
                      onClick={() => setField('personality', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 'sexuality' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Choose sexuality</h1>
                <div className="vg-chip-grid">
                  {sexualityOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`vg-chip ${state.sexuality === option ? 'is-selected' : ''}`}
                      onClick={() => setField('sexuality', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 'relationshipTone' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Set relationship vibe and tone</h1>
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
              </section>
            ) : null}

            {step === 'details' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Personal details</h1>
                <Textarea
                  name="freeformDetails"
                  placeholder="Boundaries, turn-ons, and personal notes..."
                  rows={6}
                  maxLength={400}
                  value={state.freeformDetails}
                  onChange={(event) => setField('freeformDetails', event.target.value)}
                />
              </section>
            ) : null}

            {step === 'review' ? (
              <section className="vg-step-panel">
                <h1 className="vg-step-title">Review and generate</h1>
                <img src={state.selectedPortraitImage} alt="Selected portrait" className="vg-picked-portrait" />
                <div className="vg-review-pills">
                  <span>{state.name}</span>
                  <span>{state.sex}</span>
                  <span>{state.origin}</span>
                  <span>{state.hairColor}</span>
                  <span>{state.figure}</span>
                  <span>{state.age}</span>
                  <span>{state.occupation}</span>
                  <span>{state.personality}</span>
                  <span>{state.sexuality}</span>
                  <span>{state.affectionStyle}</span>
                  <span>{state.tone}</span>
                </div>
              </section>
            ) : null}

            {error ? <p className="onboarding-error my-0">{error}</p> : null}
            {conflictHelp ? (
              <div className="rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-sm text-rose-100">
                <p className="my-0 font-semibold">Generation did not start: too close to {conflictHelp.companionName ?? 'an existing companion'}.</p>
                {conflictHelp.topFieldLabels?.length ? (
                  <p className="my-2">Most overlapping areas: {conflictHelp.topFieldLabels.slice(0, 3).join(', ')}.</p>
                ) : null}
                <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
                  {(conflictHelp.guidance?.length
                    ? conflictHelp.guidance
                    : ['Generation did not start. Change appearance, personality, or relationship vibe, then retry.']
                  ).map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="vg-step-actions">
              {step !== 'review' ? (
                <Button type="button" onClick={goNext} disabled={portraitContinueDisabled}>Continue</Button>
              ) : (
                <Button type="button" onClick={submit} disabled={isSubmitting}>Generate Companion</Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
