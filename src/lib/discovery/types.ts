export type DiscoveryProfileRecord = {
  id: string;
  display_name: string | null;
  bio: string | null;
  birth_date: string | null;
  gender: string | null;
  interested_in: string | string[] | null;
  location_text: string | null;
  onboarding_completed: boolean | null;
};

export type DiscoveryPhotoRecord = {
  user_id: string;
  storage_path: string;
  is_primary: boolean;
};

export type DiscoveryPreferenceRecord = {
  user_id: string;
  min_age: number | null;
  max_age: number | null;
  interested_in: string | string[] | null;
};

export type SwipeRecord = {
  swiper_id: string;
  target_user_id: string;
  direction: 'like' | 'dislike' | 'super_like';
};


export type DiscoveryCandidate = {
  userId: string;
  displayName: string;
  age: number | null;
  bio: string;
  location: string;
  gender: string | null;
  interestedIn: string | null;
  photoUrl: string | null;
};
