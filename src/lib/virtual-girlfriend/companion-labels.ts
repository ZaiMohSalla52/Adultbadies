export type CompanionSex = 'female' | 'male' | string | null | undefined;

export const getCompanionLabels = (sex?: CompanionSex) => {
  const isMale = (sex ?? '').toLowerCase() === 'male';

  return {
    role: isMale ? 'AI Boyfriend' : 'AI Girlfriend',
    roleShort: isMale ? 'Boyfriend' : 'Girlfriend',
    companion: 'AI Companion',
    subject: isMale ? 'he' : 'she',
    object: isMale ? 'him' : 'her',
    possessive: isMale ? 'his' : 'her',
    portraitLabel: isMale ? 'his portrait' : 'her portrait',
    photosLabel: isMale ? 'his photos' : 'her photos',
    galleryLabel: isMale ? 'his gallery' : 'her gallery',
    stylePrompt: isMale ? 'his default style' : 'her default style',
    wardrobeHint: isMale
      ? 'Sets his default wardrobe vibe for thirst traps and chat photos.'
      : 'Sets her default wardrobe vibe for photos and chat.',
    generatingPortrait: isMale ? 'Creating his portrait' : 'Creating her portrait',
    pickPortrait: isMale ? 'Pick his portrait' : 'Pick her portrait',
    statusGenerating: isMale
      ? 'His image set is still generating. We will show his portrait as soon as it is ready.'
      : 'Her image set is still generating. We will show her portrait as soon as it is ready.',
    statusFailed: isMale
      ? 'Image generation failed for this profile. You can still chat while we retry his photos.'
      : 'Image generation failed for this profile. You can still chat while we retry her photos.',
    statusPartial: isMale
      ? 'His locked portrait is ready, but some gallery moments did not finish yet.'
      : 'Her locked portrait is ready, but some gallery moments did not finish yet.',
    portraitPending: isMale
      ? 'His portrait is being prepared. Please check back in a moment.'
      : 'Her portrait is being prepared. Please check back in a moment.',
    galleryExpand: isMale
      ? 'More moments will appear here as his gallery expands.'
      : 'More moments will appear here as her gallery expands.',
    chatSelfieHint: isMale ? 'Ask him for a selfie.' : 'Ask her for a selfie.',
  };
};