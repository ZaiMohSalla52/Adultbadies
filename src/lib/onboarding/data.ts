import type {
  DatingPreferenceRecord,
  OnboardingSnapshot,
  ProfilePhotoRecord,
  ProfileRecord,
} from '@/lib/onboarding/types';
import { supabaseRest } from '@/lib/supabase/rest';

export const getOnboardingSnapshot = async (token: string, userId: string): Promise<OnboardingSnapshot> => {
  const profileQuery = new URLSearchParams({ select: '*', id: `eq.${userId}`, limit: '1' });
  const preferencesQuery = new URLSearchParams({ select: '*', user_id: `eq.${userId}`, limit: '1' });
  const photosQuery = new URLSearchParams({ select: '*', user_id: `eq.${userId}`, order: 'sort_order.asc' });

  const [profileRows, preferenceRows, photos] = await Promise.all([
    supabaseRest<ProfileRecord[]>('profiles', token, { searchParams: profileQuery }),
    supabaseRest<DatingPreferenceRecord[]>('dating_preferences', token, { searchParams: preferencesQuery }),
    supabaseRest<ProfilePhotoRecord[]>('profile_photos', token, { searchParams: photosQuery }),
  ]);

  return {
    profile: profileRows[0] ?? null,
    preferences: preferenceRows[0] ?? null,
    photos,
  };
};
