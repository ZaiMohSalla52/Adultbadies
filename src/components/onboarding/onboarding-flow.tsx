'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GENDER_OPTIONS, INTEREST_OPTIONS, ONBOARDING_STEPS } from '@/lib/onboarding/constants';
import { isAgeValid, isOnboardingComplete } from '@/lib/onboarding/completeness';
import type { OnboardingSnapshot } from '@/lib/onboarding/types';

type Props = {
  initialSnapshot: OnboardingSnapshot;
};

const normalizeInterestedIn = (value: string | string[] | null | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return value ?? '';
};

export const OnboardingFlow = ({ initialSnapshot }: Props) => {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [stepIndex, setStepIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [birthDay, setBirthDay] = useState(() => {
    const day = snapshot.profile?.birth_date?.split('-')[2] ?? '';
    return day ? String(Number(day)) : '';
  });
  const [birthMonth, setBirthMonth] = useState(() => {
    const month = snapshot.profile?.birth_date?.split('-')[1] ?? '';
    return month ? String(Number(month)) : '';
  });
  const [birthYear, setBirthYear] = useState(() => snapshot.profile?.birth_date?.split('-')[0] ?? '');

  const progress = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);

  const profileForm = useMemo(
    () => ({
      display_name: snapshot.profile?.display_name ?? '',
      bio: snapshot.profile?.bio ?? '',
      birth_date: snapshot.profile?.birth_date ?? '',
      gender: snapshot.profile?.gender ?? '',
      interested_in: snapshot.profile?.interested_in ?? '',
      location_text: snapshot.profile?.location_text ?? '',
    }),
    [snapshot.profile],
  );

  const preferenceForm = useMemo(
    () => ({
      min_age: snapshot.preferences?.min_age?.toString() ?? '25',
      max_age: snapshot.preferences?.max_age?.toString() ?? '45',
      interested_in:
        normalizeInterestedIn(snapshot.preferences?.interested_in) ||
        normalizeInterestedIn(snapshot.profile?.interested_in),
      max_distance_km: snapshot.preferences?.max_distance_km?.toString() ?? '',
    }),
    [snapshot.preferences, snapshot.profile?.interested_in],
  );

  const refresh = async () => {
    const response = await fetch('/api/onboarding/snapshot', { cache: 'no-store' });
    const next = (await response.json()) as OnboardingSnapshot;
    setSnapshot(next);
  };

  const resolveBirthDate = () => {
    if (!birthDay || !birthMonth || !birthYear) {
      return { error: 'Please select your full birth date (day, month, and year).' };
    }

    const day = Number(birthDay);
    const month = Number(birthMonth);
    const year = Number(birthYear);
    const currentYear = new Date().getUTCFullYear();

    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > currentYear
    ) {
      return { error: 'Please enter a valid birth date.' };
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    const isSameDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;

    if (!isSameDate) {
      return { error: 'Please enter a real calendar date.' };
    }

    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!isAgeValid(birthDate)) {
      return { error: 'You must be at least 18 years old.' };
    }

    return { value: birthDate };
  };

  const saveProfile = async (formData: FormData) => {
    setError(null);
    setMessage(null);

    const birthDate = resolveBirthDate();

    if (!('value' in birthDate)) {
      setError(birthDate.error);
      return;
    }

    const payload = {
      ...Object.fromEntries(formData),
      birth_date: birthDate.value,
    };

    startTransition(async () => {
      const response = await fetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Unable to save profile.');
        return;
      }

      await refresh();
      setMessage('Basics saved.');
      setStepIndex(1);
    });
  };

  const savePreferences = async (formData: FormData) => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/onboarding/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min_age: Number(formData.get('min_age')),
          max_age: Number(formData.get('max_age')),
          interested_in: formData.get('interested_in'),
          max_distance_km: formData.get('max_distance_km')
            ? Number(formData.get('max_distance_km'))
            : null,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Unable to save preferences.');
        return;
      }

      await refresh();
      setMessage('Preferences saved.');
      setStepIndex(2);
    });
  };

  const uploadPhoto = async (formData: FormData) => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/onboarding/photos', { method: 'POST', body: formData });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Unable to upload photo.');
        return;
      }

      await refresh();
      setMessage('Photo uploaded.');
    });
  };

  const updatePhoto = async (path: string, method: 'DELETE' | 'PATCH') => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(path, { method });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Photo update failed.');
        return;
      }

      await refresh();
      setMessage('Photo updated.');
    });
  };

  const reorder = async (photoId: string, direction: 'up' | 'down') => {
    const current = [...snapshot.photos];
    const index = current.findIndex((photo) => photo.id === photoId);
    const target = direction === 'up' ? index - 1 : index + 1;

    if (index < 0 || target < 0 || target >= current.length) return;

    const swapped = [...current];
    const temp = swapped[index];
    swapped[index] = swapped[target];
    swapped[target] = temp;

    startTransition(async () => {
      await fetch('/api/onboarding/photos/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: swapped.map((item) => item.id) }),
      });

      await refresh();
    });
  };

  const finishOnboarding = async () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch('/api/onboarding/complete', { method: 'POST' });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? 'Unable to complete onboarding.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    });
  };

  const monthOptions = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1));
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, index) => String(currentYear - index));

  return (
    <Card className="max-w-2xl">
      <h1 className="my-0 mb-2 text-3xl font-bold">Profile onboarding</h1>
      <p className="text-sm text-muted">Step {stepIndex + 1} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[stepIndex]}</p>
      <div className="onboarding-progress">
        <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {error ? <p className="onboarding-error">{error}</p> : null}
      {message ? <p className="onboarding-success">{message}</p> : null}

      {stepIndex === 0 ? (
        <form action={saveProfile} className="onboarding-grid">
          <Input name="display_name" defaultValue={profileForm.display_name} placeholder="Display name" required />
          <Textarea name="bio" defaultValue={profileForm.bio} placeholder="Short bio" rows={4} required />
          <div className="onboarding-grid">
            <p className="my-0 text-sm text-muted">Birth date</p>
            <div className="onboarding-date-grid">
              <Select name="birth_day" value={birthDay} onChange={(event) => setBirthDay(event.target.value)} required>
                <option value="">Day</option>
                {days.map((day) => (
                  <option value={day} key={day}>{day}</option>
                ))}
              </Select>
              <Select name="birth_month" value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)} required>
                <option value="">Month</option>
                {monthOptions.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </Select>
              <Select name="birth_year" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} required>
                <option value="">Year</option>
                {years.map((year) => (
                  <option value={year} key={year}>{year}</option>
                ))}
              </Select>
            </div>
          </div>
          <Select name="gender" defaultValue={profileForm.gender} required>
            <option value="">Select your gender</option>
            {GENDER_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select name="interested_in" defaultValue={profileForm.interested_in} required>
            <option value="">Interested in</option>
            {INTEREST_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </Select>
          <Input name="location_text" defaultValue={profileForm.location_text} placeholder="City, region" required />
          <div className="flex gap-3">
            <Button type="submit" disabled={pending}>Save & continue</Button>
          </div>
        </form>
      ) : null}

      {stepIndex === 1 ? (
        <form action={savePreferences} className="onboarding-grid">
          <div className="onboarding-inline-grid">
            <Input name="min_age" type="number" min={18} max={100} defaultValue={preferenceForm.min_age} required />
            <Input name="max_age" type="number" min={18} max={100} defaultValue={preferenceForm.max_age} required />
          </div>
          <Select name="interested_in" defaultValue={preferenceForm.interested_in} required>
            <option value="">Interested in</option>
            {INTEREST_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </Select>
          <Input
            name="max_distance_km"
            type="number"
            min={1}
            placeholder="Max distance (km, optional)"
            defaultValue={preferenceForm.max_distance_km}
          />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStepIndex(0)}>Back</Button>
            <Button type="submit" disabled={pending}>Save & continue</Button>
          </div>
        </form>
      ) : null}

      {stepIndex === 2 ? (
        <div className="onboarding-grid">
          <form action={uploadPhoto} className="onboarding-inline-grid">
            <Input name="photo" type="file" accept="image/*" required />
            <Button type="submit" disabled={pending}>Upload</Button>
          </form>
          <div className="onboarding-photo-list">
            {snapshot.photos.length === 0 ? <p className="text-sm text-muted">At least one photo is required.</p> : null}
            {snapshot.photos.map((photo, index) => (
              <div key={photo.id} className="onboarding-photo-row">
                <span className="text-sm">Photo {index + 1} {photo.is_primary ? '(Primary)' : ''}</span>
                <div className="flex gap-2">
                  {!photo.is_primary ? (
                    <Button type="button" variant="ghost" onClick={() => updatePhoto(`/api/onboarding/photos/${photo.id}/primary`, 'PATCH')}>
                      Set primary
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" onClick={() => reorder(photo.id, 'up')}>↑</Button>
                  <Button type="button" variant="ghost" onClick={() => reorder(photo.id, 'down')}>↓</Button>
                  <Button type="button" variant="secondary" onClick={() => updatePhoto(`/api/onboarding/photos/${photo.id}`, 'DELETE')}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStepIndex(1)}>Back</Button>
            <Button type="button" onClick={() => setStepIndex(3)} disabled={snapshot.photos.length === 0}>Continue</Button>
          </div>
        </div>
      ) : null}

      {stepIndex === 3 ? (
        <div className="onboarding-grid">
          <p className="text-sm text-muted">
            Review complete. You can finish onboarding when all required fields are set and at least one photo is uploaded.
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={() => setStepIndex(2)}>Back</Button>
            <Button type="button" onClick={finishOnboarding} disabled={pending || !isOnboardingComplete(snapshot)}>
              Complete onboarding
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
};
