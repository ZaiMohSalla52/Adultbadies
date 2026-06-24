'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const AgeGateForm = () => {
  const router = useRouter();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!consent) {
      setError('Please confirm you are 18+ and consent to adult content.');
      return;
    }

    setPending(true);
    try {
      const response = await fetch('/api/safety/age-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateOfBirth, consent }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? 'Unable to verify age right now.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form-fields" noValidate>
      <label className="auth-form-label" htmlFor="age-dob">
        Date of birth
      </label>
      <Input
        id="age-dob"
        type="date"
        name="dateOfBirth"
        value={dateOfBirth}
        onChange={(event) => setDateOfBirth(event.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        required
      />

      <label className="auth-form-label" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          I confirm that I am at least 18 years old and I consent to viewing adult content. I understand
          all companions are fictional, AI-generated adults.
        </span>
      </label>

      {error ? <p className="auth-form-error">{error}</p> : null}

      <Button type="submit" disabled={pending || !dateOfBirth || !consent}>
        {pending ? 'Verifying…' : 'Confirm and enter'}
      </Button>
    </form>
  );
};
