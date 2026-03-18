# IMAGE SYSTEM PRINCIPLES

This document captures the current image system principles after prompt-lineage persistence wiring.

## 1) One canonical image machine core

- Setup, regenerate, gallery expansion, and chat image generation run through the same core machine flow in `src/lib/virtual-girlfriend/image-machine.ts`.
- Generation prompts are produced per surface, then passed directly to Ideogram.
- Persisted records store lineage values that match the actual outbound prompt payload.

## 2) Preview is ephemeral

- Portrait preview remains a non-persistent surface.
- Preview candidates return data URLs only.
- No `ai_companion_images` rows are created for preview.
- No prompt-lineage rows are written for preview.

## 3) Canonical is the identity lock

- Canonical setup generation persists:
  - prompt text
  - prompt version
  - surface type
- Visual profiles store the canonical seed lineage:
  - `seed_prompt`
  - `prompt_version`
  - `surface_type`
- This profile seed lineage is the canonical identity lock for future generations.

## 4) Regenerate is seed-faithful

- Regenerate checks `visualProfile.seed_prompt` first.
- If a stored seed exists, regenerate uses that exact stored canonical seed prompt.
- If no stored seed exists, regenerate falls back to the regenerate prompt builder.

## 5) Surface params remain centralized

- Surface behavior and prompt versioning remain surface-scoped.
- Prompt versions come from `PROMPT_VERSION` and are persisted per generated non-preview image.
- Surface type persisted per image is:
  - `canonical` for setup canonical
  - `gallery` for setup/gallery expansion
  - `regenerate` for canonical regenerate outputs
  - `chat` for chat image generation

## 6) Debugging and traceability via lineage helpers

- `getImageLineage(imageId)` returns prompt lineage for one image.
- `getProfileSeedPrompt(visualProfileId)` returns canonical seed lineage for one profile.
- `getCompanionGenerationHistory(companionId, limit?)` returns surface/version generation history for a companion.

These helpers are intended for operational debugging and lineage verification, not UI behavior changes.
