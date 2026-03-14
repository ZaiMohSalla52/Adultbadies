import type { OnboardingSnapshot, ProfileRecord } from '@/lib/onboarding/types';

const calculateAge = (birthDate: string) => {
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthOffset = today.getUTCMonth() - dob.getUTCMonth();

  if (monthOffset < 0 || (monthOffset === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }

  return age;
};

export const isAgeValid = (birthDate?: string | null) => {
  if (!birthDate) return false;

  const age = calculateAge(birthDate);
  return age >= 18;
};

const hasRequiredProfileFields = (profile: ProfileRecord | null) => {
  if (!profile) return false;

  return Boolean(
    profile.display_name?.trim() &&
      profile.bio?.trim() &&
      profile.gender?.trim() &&
      profile.interested_in?.trim() &&
      profile.location_text?.trim() &&
      isAgeValid(profile.birth_date),
  );
};

export const isOnboardingComplete = (snapshot: OnboardingSnapshot) => {
  if (!hasRequiredProfileFields(snapshot.profile)) return false;

  const hasPreferenceAges =
    typeof snapshot.preferences?.min_age === 'number' &&
    typeof snapshot.preferences?.max_age === 'number' &&
    snapshot.preferences.min_age >= 18 &&
    snapshot.preferences.max_age >= snapshot.preferences.min_age;

  if (!hasPreferenceAges || !snapshot.preferences?.interested_in) return false;

  return snapshot.photos.length > 0;
};
