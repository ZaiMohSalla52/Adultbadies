export type ProfileRecord = {
  id: string;
  display_name: string | null;
  bio: string | null;
  birth_date: string | null;
  gender: string | null;
  interested_in: string | null;
  location_text: string | null;
  onboarding_completed: boolean | null;
};

export type DatingPreferenceRecord = {
  user_id: string;
  min_age: number | null;
  max_age: number | null;
  interested_in: string | null;
  max_distance_km: number | null;
};

export type ProfilePhotoRecord = {
  id: string;
  user_id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
};

export type OnboardingSnapshot = {
  profile: ProfileRecord | null;
  preferences: DatingPreferenceRecord | null;
  photos: ProfilePhotoRecord[];
};
