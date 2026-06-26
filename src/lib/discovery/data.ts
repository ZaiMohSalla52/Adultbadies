import { env } from '@/lib/env';
import { repairCompanionImageDeliveryUrl } from '@/lib/storage/delivery-url';
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

const normalizeToken = (value: string | string[] | null | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim().toLowerCase() ?? '';
};

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

type VgCompanionRow = {
  id: string;
  user_id: string;
  name: string;
  display_bio: string | null;
  disclosure_label: string | null;
  structured_profile: { sex?: string | null; styleVibe?: string | null; archetype?: string | null } | null;
  archetype: string | null;
};

type VgImageRow = {
  companion_id: string;
  delivery_url: string;
  image_kind: string;
  delivery_provider?: string | null;
  origin_storage_provider?: string | null;
  origin_storage_key?: string | null;
};

export const getDiscoverableVirtualGirlfriends = async (token: string, userId: string): Promise<DiscoveryCandidate[]> => {
  const companions = await supabaseRest<VgCompanionRow[]>('ai_companions', token, {
    searchParams: new URLSearchParams({
      select: 'id,user_id,name,display_bio,disclosure_label,structured_profile,archetype',
      is_discoverable: 'eq.true',
      setup_completed: 'eq.true',
      user_id: `neq.${userId}`,
      limit: '20',
    }),
  });

  if (companions.length === 0) return [];

  const companionIds = companions.map((c) => c.id);
  const images = await supabaseRest<VgImageRow[]>('ai_companion_images', token, {
    searchParams: new URLSearchParams({
      select: 'companion_id,delivery_url,image_kind,delivery_provider,origin_storage_provider,origin_storage_key',
      companion_id: `in.(${companionIds.join(',')})`,
      image_kind: 'eq.canonical',
      limit: '50',
    }),
  });

  const imageByCompanionId = new Map(
    images.map((img) => [img.companion_id, repairCompanionImageDeliveryUrl(img)]),
  );

  return companions.map((companion) => {
    const sex = (companion.structured_profile?.sex ?? 'female').toLowerCase();
    return {
      userId: `vg:${companion.id}`,
      displayName: companion.name,
      age: null,
      bio: companion.display_bio?.trim() || companion.archetype?.trim() || 'Your perfect AI companion.',
      location: 'Virtual',
      gender: sex === 'male' ? 'male' : 'female',
      interestedIn: null,
      photoUrl: imageByCompanionId.get(companion.id) ?? null,
      kind: 'virtual_girlfriend',
      companionId: companion.id,
      disclosureLabel: companion.disclosure_label ?? '',
      styleVibe: companion.structured_profile?.styleVibe ?? null,
    };
  });
};

const DISCOVERY_PROFILE_POOL = 80;
const DISCOVERY_RESULT_LIMIT = 50;

export const getDiscoveryCandidates = async (token: string, userId: string): Promise<DiscoveryCandidate[]> => {
  const [currentProfileRows, currentPreferenceRows, swipeRows, blockedIds] = await Promise.all([
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
    supabaseRest<SwipeRecord[]>('swipes', token, {
      searchParams: new URLSearchParams({
        select: 'target_user_id',
        swiper_id: `eq.${userId}`,
        limit: '500',
      }),
    }),
    getBlockedUserIds(token, userId),
  ]);

  const currentProfile = currentProfileRows[0] ?? null;
  const currentPreference = currentPreferenceRows[0] ?? null;
  const alreadySwipedIds = new Set(swipeRows.map((swipe) => swipe.target_user_id));

  const profileParams = new URLSearchParams({
    select: 'id,display_name,bio,birth_date,gender,interested_in,location_text,onboarding_completed',
    onboarding_completed: 'eq.true',
    id: `neq.${userId}`,
    order: 'updated_at.desc',
    limit: String(DISCOVERY_PROFILE_POOL),
  });

  const interest = normalizeToken(currentPreference?.interested_in);
  if (interest && interest !== 'everyone') {
    profileParams.set('gender', `eq.${interest}`);
  }

  const profiles = await supabaseRest<DiscoveryProfileRecord[]>('profiles', token, {
    searchParams: profileParams,
  });

  const filteredProfiles = profiles
    .filter((profile) => !alreadySwipedIds.has(profile.id))
    .filter((profile) => !blockedIds.has(profile.id))
    .slice(0, DISCOVERY_PROFILE_POOL);

  if (filteredProfiles.length === 0) return [];

  const candidateIds = filteredProfiles.map((profile) => profile.id);
  const [photoRows, preferenceRows] = await Promise.all([
    supabaseRest<DiscoveryPhotoRecord[]>('profile_photos', token, {
      searchParams: new URLSearchParams({
        select: 'user_id,storage_path,is_primary',
        is_primary: 'eq.true',
        user_id: `in.(${candidateIds.join(',')})`,
      }),
    }),
    supabaseRest<DiscoveryPreferenceRecord[]>('dating_preferences', token, {
      searchParams: new URLSearchParams({
        select: 'user_id,min_age,max_age,interested_in',
        user_id: `in.(${candidateIds.join(',')})`,
      }),
    }),
  ]);

  const photoByUser = new Map(photoRows.map((photo) => [photo.user_id, photo]));
  const preferenceByUser = new Map(preferenceRows.map((preference) => [preference.user_id, preference]));

  return filteredProfiles
    .filter((profile) => isMutualInterest(currentProfile, currentPreference, profile, preferenceByUser.get(profile.id) ?? null))
    .slice(0, DISCOVERY_RESULT_LIMIT)
    .map((profile) => {
      const photo = photoByUser.get(profile.id);

      return {
        userId: profile.id,
        displayName: profile.display_name?.trim() || 'Anonymous',
        age: calculateAge(profile.birth_date),
        bio: profile.bio?.trim() || 'No bio yet.',
        location: profile.location_text?.trim() || 'Unknown location',
        gender: profile.gender,
        interestedIn: normalizeToken(profile.interested_in) || null,
        photoUrl: photo ? toPhotoUrl(photo.storage_path) : null,
        kind: 'human',
      } satisfies DiscoveryCandidate;
    });
};
