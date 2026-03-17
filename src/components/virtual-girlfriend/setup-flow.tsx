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

type CreatorStep = 1 | 2 | 3 | 4 | 5;

type CreatorState = {
  name: string;
  sex: string;
  age: string;
  origin: string;
  ethnicity: string;
  hairColor: string;
  figure: string;
  chestSize: string;
  visualAesthetic: string;
  occupation: string;
  personality: string;
  sexuality: string;
  archetype: string;
  tone: string;
  affectionStyle: string;
  freeformDetails: string;
  likes: string;
  habits: string;
};

const initialState: CreatorState = {
  name: '',
  sex: 'Female',
  age: '',
  origin: '',
  ethnicity: '',
  hairColor: '',
  figure: '',
  chestSize: '',
  visualAesthetic: '',
  occupation: '',
  personality: '',
  sexuality: '',
  archetype: '',
  tone: '',
  affectionStyle: '',
  freeformDetails: '',
  likes: '',
  habits: '',
};

const sexOptions = ['Female', 'Male', 'Non-binary'];
const originOptions = ['North American', 'European', 'Latin American', 'East Asian', 'South Asian', 'Middle Eastern', 'African', 'Oceanian'];
const hairOptions = [
  { value: 'Jet black', swatch: '#09090b' },
  { value: 'Dark brown', swatch: '#4a2c1b' },
  { value: 'Light brown', swatch: '#8b5a2b' },
  { value: 'Blonde', swatch: '#f4d186' },
  { value: 'Platinum', swatch: '#f5f5f4' },
  { value: 'Auburn', swatch: '#a7441f' },
  { value: 'Red', swatch: '#d9482b' },
  { value: 'Silver', swatch: '#cbd5e1' },
];
const figureOptions = ['Slim', 'Athletic', 'Curvy', 'Hourglass', 'Petite', 'Plus-size'];
const chestOptions = ['Petite', 'Medium', 'Full', 'Voluptuous'];
const personalityOptions = ['Warm romantic', 'Playful tease', 'Confident bombshell', 'Bookish charmer', 'Calm sweetheart'];
const sexualityOptions = ['Straight', 'Bisexual', 'Pansexual', 'Fluid'];

const splitCsv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);

export const VirtualGirlfriendSetupFlow = ({ createNew = false }: { createNew?: boolean }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<CreatorStep>(1);
  const [state, setState] = useState<CreatorState>(initialState);
  const [generationStarted, setGenerationStarted] = useState(false);

  const progress = useMemo(() => (step / 5) * 100, [step]);

  const setField = <K extends keyof CreatorState>(key: K, value: CreatorState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const stepValidationError = (targetStep: CreatorStep): string | null => {
    if (targetStep === 1 && !state.name.trim()) return 'Please choose a name to continue.';
    if (targetStep === 2 && (!state.hairColor || !state.figure || !state.chestSize || !state.visualAesthetic)) {
      return 'Select appearance details before continuing.';
    }
    if (targetStep === 3 && (!state.archetype || !state.tone || !state.affectionStyle || !state.personality || !state.sexuality)) {
      return 'Complete the character selections before continuing.';
    }
    return null;
  };

  const goNext = () => {
    const nextStep = Math.min(5, step + 1) as CreatorStep;
    const validationError = stepValidationError(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep(nextStep);
  };

  const goBack = () => {
    setError(null);
    setStep((current) => Math.max(1, current - 1) as CreatorStep);
  };

  const submit = () => {
    const reviewError = stepValidationError(1) ?? stepValidationError(2) ?? stepValidationError(3);
    if (reviewError || !state.name.trim()) {
      setError(reviewError ?? 'Please enter a companion name.');
      return;
    }

    setError(null);
    setGenerationStarted(true);

    startTransition(async () => {
      let response: Response;

      const payload = {
        createNew,
        name: state.name.trim(),
        sex: state.sex,
        age: state.age,
        origin: state.origin,
        ethnicity: state.ethnicity,
        hairColor: state.hairColor,
        figure: state.figure,
        chestSize: state.chestSize,
        occupation: state.occupation,
        personality: state.personality,
        sexuality: state.sexuality,
        freeformDetails: state.freeformDetails,
        likes: splitCsv(state.likes),
        habits: splitCsv(state.habits),
        preferenceHints: state.freeformDetails,
        archetype: state.archetype,
        tone: state.tone,
        affectionStyle: state.affectionStyle,
        visualAesthetic: state.visualAesthetic,
      };

      try {
        response = await fetch('/api/virtual-girlfriend/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        setGenerationStarted(false);
        setError('Unable to start generation right now. Please try again in a moment.');
        setStep(5);
        return;
      }

      const body = (await response.json()) as { error?: string; companionId?: string };

      if (!response.ok) {
        setError(body.error ?? 'Unable to create your Virtual Girlfriend.');
        setGenerationStarted(false);
        setStep(5);
        return;
      }

      const destination = body.companionId
        ? `/virtual-girlfriend/profile?companionId=${body.companionId}`
        : '/virtual-girlfriend/profile';

      router.push(destination);
      router.refresh();
    });
  };

  const isSubmitting = generationStarted || pending;

  return (
    <div className="app-page-stack">
      <Card className="app-page-header vg-setup-header">
        <p className="chat-label">Virtual Girlfriend Creator</p>
        <h1 className="my-0">{createNew ? 'Create another unique companion' : 'Build your dream AI companion'}</h1>
        <p className="my-0 text-muted">Guided, visual setup tuned for mobile. Shape her vibe, appearance, and personality before generation.</p>
      </Card>

      <Card className="app-surface-card vg-setup-shell">
        {isSubmitting ? (
          <div className="vg-generation-state" role="status" aria-live="polite">
            <span className="vg-generation-orb" aria-hidden="true" />
            <p className="my-0 text-sm font-semibold text-white">Creating unique {state.name.trim() || 'your companion'}&rsquo;s portrait</p>
            <p className="my-0 text-sm text-muted">Building her profile, photos, and memory setup.</p>
            <p className="my-0 text-xs text-muted">You can leave this page and check back shortly.</p>
            <div className="vg-generation-summary">
              <span>{state.sex}</span>
              <span>{state.age ? `${state.age} yrs` : 'Age set later'}</span>
              <span>{state.hairColor || 'Hair TBD'}</span>
              <span>{state.personality || 'Personality selected'}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="vg-setup-progress">
              <div className="vg-setup-progress-copy">
                <p className="my-0 text-xs text-muted">Step {step} of 5</p>
                <p className="my-0 text-sm font-semibold text-white">
                  {step === 1 && 'Core identity'}
                  {step === 2 && 'Appearance'}
                  {step === 3 && 'Character'}
                  {step === 4 && 'Personal details'}
                  {step === 5 && 'Review'}
                </p>
              </div>
              <div className="vg-setup-progress-track" aria-hidden="true">
                <div className="vg-setup-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {step === 1 ? (
              <section className="vg-step-grid">
                <Input
                  name="name"
                  placeholder="Companion name *"
                  maxLength={40}
                  value={state.name}
                  onChange={(event) => setField('name', event.target.value)}
                  required
                />
                <div className="vg-choice-grid">
                  {sexOptions.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.sex === option ? 'is-selected' : ''}`} onClick={() => setField('sex', option)}>
                      {option}
                    </button>
                  ))}
                </div>
                <Input name="age" placeholder="Age" maxLength={3} value={state.age} onChange={(event) => setField('age', event.target.value)} />
                <div className="vg-choice-grid">
                  {originOptions.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.origin === option ? 'is-selected' : ''}`} onClick={() => setField('origin', option)}>
                      {option}
                    </button>
                  ))}
                </div>
                <Input
                  name="ethnicity"
                  placeholder="Ethnicity (optional)"
                  maxLength={80}
                  value={state.ethnicity}
                  onChange={(event) => setField('ethnicity', event.target.value)}
                />
              </section>
            ) : null}

            {step === 2 ? (
              <section className="vg-step-grid">
                <div className="vg-swatch-grid">
                  {hairOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`vg-swatch-card ${state.hairColor === option.value ? 'is-selected' : ''}`}
                      onClick={() => setField('hairColor', option.value)}
                    >
                      <span className="vg-swatch-dot" style={{ backgroundColor: option.swatch }} aria-hidden="true" />
                      <span>{option.value}</span>
                    </button>
                  ))}
                </div>

                <div className="vg-image-choice-grid">
                  {figureOptions.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      className={`vg-image-choice-card ${state.figure === option ? 'is-selected' : ''}`}
                      onClick={() => setField('figure', option)}
                      style={{ backgroundImage: `linear-gradient(170deg, rgba(236,72,153,0.${index + 2}), rgba(30,41,59,0.92))` }}
                    >
                      <span>{option}</span>
                    </button>
                  ))}
                </div>

                <div className="vg-choice-grid">
                  {chestOptions.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.chestSize === option ? 'is-selected' : ''}`} onClick={() => setField('chestSize', option)}>
                      {option}
                    </button>
                  ))}
                </div>

                <div className="vg-image-choice-grid">
                  {VIRTUAL_GIRLFRIEND_VISUAL_AESTHETICS.map((option, index) => (
                    <button
                      key={option}
                      type="button"
                      className={`vg-image-choice-card ${state.visualAesthetic === option ? 'is-selected' : ''}`}
                      onClick={() => setField('visualAesthetic', option)}
                      style={{ backgroundImage: `linear-gradient(180deg, rgba(251,113,133,0.${index + 2}), rgba(15,23,42,0.9))` }}
                    >
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="vg-step-grid">
                <Input
                  name="occupation"
                  placeholder="Occupation"
                  maxLength={80}
                  value={state.occupation}
                  onChange={(event) => setField('occupation', event.target.value)}
                />

                <div className="vg-choice-grid">
                  {personalityOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`vg-choice-card vg-icon-choice-card ${state.personality === option ? 'is-selected' : ''}`}
                      onClick={() => setField('personality', option)}
                    >
                      <span aria-hidden="true">✨</span>
                      {option}
                    </button>
                  ))}
                </div>

                <div className="vg-choice-grid">
                  {sexualityOptions.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.sexuality === option ? 'is-selected' : ''}`} onClick={() => setField('sexuality', option)}>
                      {option}
                    </button>
                  ))}
                </div>

                <div className="vg-choice-grid">
                  {VIRTUAL_GIRLFRIEND_ARCHETYPES.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.archetype === option ? 'is-selected' : ''}`} onClick={() => setField('archetype', option)}>
                      {option}
                    </button>
                  ))}
                </div>

                <div className="vg-choice-grid">
                  {VIRTUAL_GIRLFRIEND_TONES.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.tone === option ? 'is-selected' : ''}`} onClick={() => setField('tone', option)}>
                      {option}
                    </button>
                  ))}
                </div>

                <div className="vg-choice-grid">
                  {VIRTUAL_GIRLFRIEND_AFFECTION_STYLES.map((option) => (
                    <button key={option} type="button" className={`vg-choice-card ${state.affectionStyle === option ? 'is-selected' : ''}`} onClick={() => setField('affectionStyle', option)}>
                      {option}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="vg-step-grid">
                <Textarea
                  name="freeformDetails"
                  placeholder="Likes, habits, fantasy details, custom notes..."
                  rows={5}
                  maxLength={400}
                  value={state.freeformDetails}
                  onChange={(event) => setField('freeformDetails', event.target.value)}
                />
                <Input
                  name="likes"
                  placeholder="Likes (comma separated)"
                  maxLength={240}
                  value={state.likes}
                  onChange={(event) => setField('likes', event.target.value)}
                />
                <Input
                  name="habits"
                  placeholder="Habits (comma separated)"
                  maxLength={240}
                  value={state.habits}
                  onChange={(event) => setField('habits', event.target.value)}
                />
              </section>
            ) : null}

            {step === 5 ? (
              <section className="vg-step-grid vg-review-sheet">
                <h2 className="my-0 text-base">Final review</h2>
                <div className="vg-generation-summary">
                  <span>{state.name || 'Unnamed'}</span>
                  <span>{state.sex}</span>
                  <span>{state.age || 'Age flexible'}</span>
                  <span>{state.origin || 'Origin flexible'}</span>
                  <span>{state.ethnicity || 'Ethnicity flexible'}</span>
                  <span>{state.hairColor || 'Hair TBD'}</span>
                  <span>{state.figure || 'Figure TBD'}</span>
                  <span>{state.chestSize || 'Chest TBD'}</span>
                  <span>{state.occupation || 'Occupation open'}</span>
                  <span>{state.personality || 'Personality TBD'}</span>
                  <span>{state.sexuality || 'Sexuality open'}</span>
                </div>
                {state.freeformDetails ? <p className="my-0 text-sm text-muted">{state.freeformDetails}</p> : null}
              </section>
            ) : null}

            {error ? <p className="onboarding-error my-0">{error}</p> : null}

            <div className="vg-step-actions">
              <Button variant="ghost" disabled={step === 1} type="button" onClick={goBack}>Back</Button>
              {step < 5 ? (
                <Button type="button" onClick={goNext}>Continue</Button>
              ) : (
                <Button type="button" onClick={submit} disabled={isSubmitting || !state.name.trim()}>
                  Create Virtual Girlfriend
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
