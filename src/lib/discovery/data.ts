import { env } from '@/lib/env';
import { supabaseRest } from '@/lib/supabase/rest';
import type { DiscoveryCandidate, DiscoveryPhotoRecord, DiscoveryPreferenceRecord, DiscoveryProfileRecord, SwipeRecord } from '@/lib/discovery/types';
import { getBlockedUserIds } from '@/lib/safety/data';

const calculateAge = (birthDate: string | null) => {
  if (!birthDate) return null;

  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const monthOffset = now.getUTCMonth() - date.getUTCMonth();

  if (monthOffset < 0 || (monthOffset === 0 && now.getUTCDate() < date.getUTCDate())) {
    age -= 1;
  }

  return age;
};

const normalizeToken = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';

const isMutualInterest = (
  currentProfile: DiscoveryProfileRecord | null,
  currentPreference: DiscoveryPreferenceRecord | null,
  candidate: DiscoveryProfileRecord,
  candidatePreference: DiscoveryPreferenceRecord | null,
) => {
  const candidateGender = normalizeToken(candidate.gender);
  const userGender = normalizeToken(currentProfile?.gender);

  if (currentPreference?.interested_in && candidateGender) {
    const interest = normalizeToken(currentPreference.interested_in);
    if (interest !== 'everyone' && interest !== candidateGender) {
      return false;
    }
  }

  if (currentProfile?.interested_in && userGender) {
    const candidateInterest = normalizeToken(candidate.interested_in || candidatePreference?.interested_in);
    if (candidateInterest && candidateInterest !== 'everyone' && candidateInterest !== userGender) {
      return false;
    }
  }

  const candidateAge = calculateAge(candidate.birth_date);

  if (candidateAge !== null && currentPreference?.min_age && currentPreference?.max_age) {
    if (candidateAge < currentPreference.min_age || candidateAge > currentPreference.max_age) {
      return false;
    }
  }

  return true;
};

const toPhotoUrl = (storagePath: string) =>
  `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-photos/${storagePath}`;

export const getDiscoveryCandidates = async (token: string, userId: string): Promise<DiscoveryCandidate[]> => {
  const [profiles, currentProfileRows, currentPreferenceRows, preferenceRows, photoRows, swipeRows, blockedIds] =
    await Promise.all([
      supabaseRest<DiscoveryProfileRecord[]>('profiles', token, {
        searchParams: new URLSearchParams({
          select: 'id,display_name,bio,birth_date,gender,interested_in,location_text,onboarding_completed',
          onboarding_completed: 'eq.true',
          id: `neq.${userId}`,
        }),
      }),
      supabaseRest<DiscoveryProfileRecord[]>('profiles', token, {
        searchParams: new URLSearchParams({
          select: 'id,display_name,bio,birth_date,gender,interested_in,location_text,onboarding_completed',
          id: `eq.${userId}`,
          limit: '1',
        }),
      }),
      supabaseRest<DiscoveryPreferenceRecord[]>('dating_preferences', token, {
        searchParams: new URLSearchParams({
          select: 'user_id,min_age,max_age,interested_in',
          user_id: `eq.${userId}`,
          limit: '1',
        }),
      }),
      supabaseRest<DiscoveryPreferenceRecord[]>('dating_preferences', token, {
        searchParams: new URLSearchParams({ select: 'user_id,min_age,max_age,interested_in' }),
      }),
      supabaseRest<DiscoveryPhotoRecord[]>('profile_photos', token, {
        searchParams: new URLSearchParams({
          select: 'user_id,storage_path,is_primary',
          is_primary: 'eq.true',
        }),
      }),
      supabaseRest<SwipeRecord[]>('swipes', token, {
        searchParams: new URLSearchParams({ select: 'swiper_id,target_user_id,direction' }),
      }),
      getBlockedUserIds(token, userId),
    ]);

  const currentProfile = currentProfileRows[0] ?? null;
  const currentPreference = currentPreferenceRows[0] ?? null;

  const alreadySwipedIds = new Set(
    swipeRows.filter((swipe) => swipe.swiper_id === userId).map((swipe) => swipe.target_user_id),
  );

  const photoByUser = new Map(photoRows.map((photo) => [photo.user_id, photo]));
  const preferenceByUser = new Map(preferenceRows.map((preference) => [preference.user_id, preference]));

  return profiles
    .filter((profile) => !alreadySwipedIds.has(profile.id))
    .filter((profile) => !blockedIds.has(profile.id))
    .filter((profile) => isMutualInterest(currentProfile, currentPreference, profile, preferenceByUser.get(profile.id) ?? null))
    .map((profile) => {
      const photo = photoByUser.get(profile.id);

      return {
        userId: profile.id,
        displayName: profile.display_name?.trim() || 'Anonymous',
        age: calculateAge(profile.birth_date),
        bio: profile.bio?.trim() || 'No bio yet.',
        location: profile.location_text?.trim() || 'Unknown location',
        gender: profile.gender,
        interestedIn: profile.interested_in,
        photoUrl: photo ? toPhotoUrl(photo.storage_path) : null,
      } satisfies DiscoveryCandidate;
    });
};
