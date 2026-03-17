# Adult Badies — Site-wide image generation audit

## 1. EXECUTIVE VERDICT
Image generation is **not one single failure**; it is a fragmented system with at least three competing paths (setup pack, chat image resolver, and portrait-candidate seed generation) that use different providers and contracts. Setup can be blocked pre-generation by distinctness, can partially succeed (canonical persisted but gallery failed) yet still return `ok: true`, and UI states frequently blur blocked/failed/generating outcomes. Identity lock is mostly canonicalized through `visual_profile.canonical_reference_image_id`, but chat can silently bypass fresh generation by reusing oldest gallery/canonical images, and moderation/review statuses are recorded but not enforced for user visibility.

## 2. IMAGE GENERATION ENTRY POINT INVENTORY

### A) Virtual Girlfriend setup final generation (canonical + gallery pack)
- **Entry:** `POST /api/virtual-girlfriend/setup` in `src/app/api/virtual-girlfriend/setup/route.ts`
- **Core call:** `generateAndPersistVirtualGirlfriendImagePack(...)` in `src/lib/virtual-girlfriend/visual-identity.ts`
- **Trigger:** User clicks generate/submit on setup review step in `src/components/virtual-girlfriend/setup-flow.tsx`
- **Sync/async:** synchronous request lifecycle (no queue)
- **Return mode:** API returns after generation attempt completes (`ready` or `failed` imageStatus)
- **Live/dead:** live canonical path

### B) Virtual Girlfriend portrait-candidate seed generation (setup portrait picker)
- **Entry:** `POST /api/virtual-girlfriend/portrait-candidates` in `src/app/api/virtual-girlfriend/portrait-candidates/route.ts`
- **Core call:** `generateVirtualGirlfriendImage({ provider: 'openai', mode: 'legacy_independent' })` via `src/lib/virtual-girlfriend/image-provider.ts`
- **Trigger:** Step navigation to portrait step (`maybeGeneratePortraits`) in `src/components/virtual-girlfriend/setup-flow.tsx`
- **Sync/async:** synchronous request lifecycle
- **Return mode:** returns immediate data URLs for candidate previews
- **Live/dead:** live, but legacy-style provider abstraction branch

### C) Chat-triggered image generation/reuse
- **Entry:** `POST /api/virtual-girlfriend/chat/stream` in `src/app/api/virtual-girlfriend/chat/stream/route.ts`
- **Core call:** `resolveVirtualGirlfriendChatImage(...)` in `src/lib/virtual-girlfriend/chat-images.ts`
- **Trigger:** user asks for photo or contextual trigger logic in chat
- **Sync/async:** synchronous in request before streaming reply starts
- **Return mode:** either reuses existing image or generates one from canonical reference and inserts DB row
- **Live/dead:** live

### D) Admin canonical regenerate (+ optional gallery regenerate)
- **Entry:** server action `regenerateCanonical` in `src/app/(admin)/overview/page.tsx`
- **Core call:** `regenerateCanonicalForVisualProfile(...)` in `src/lib/virtual-girlfriend/visual-identity.ts`
- **Trigger:** admin clicks regenerate canonical / regenerate gallery from canonical
- **Sync/async:** synchronous server action
- **Return mode:** revalidates page after attempt; errors are logged, not surfaced as UI hard errors
- **Live/dead:** live

### E) Provider abstraction entrypoint
- **Entry:** `generateVirtualGirlfriendImage(...)` in `src/lib/virtual-girlfriend/image-provider.ts`
- **Used by:** portrait-candidates route only
- **Sync/async:** sync per request
- **Live/dead:** partially live, mostly legacy/duplicate (main production pack path bypasses this abstraction)

### F) Canonical review/moderation workflow entrypoints
- **Admin API:** `src/app/api/admin/virtual-girlfriend/canonical-review/route.ts` (GET/POST)
- **Admin UI source:** `src/app/(admin)/overview/page.tsx` uses server actions + data access directly
- **Trigger:** reviewer moderation decisions
- **Sync/async:** sync request/action
- **Live/dead:** API route appears unused by local UI; likely duplicate path

## 3. CANONICAL ARCHITECTURE MAP

### Canonical setup generation path (actual live architecture)
1. **Request origin**: setup UI `submit()` posts payload with structured traits + selected portrait prompt/image.
2. **Validation/parsing**: `/api/virtual-girlfriend/setup` validates required setup fields and name.
3. **Normalization**: `normalizeSetupInput(...)` builds structured profile.
4. **Pre-gen gate**: `findDistinctnessConflict(...)` can return 409 and halt generation before provider call.
5. **Persona generation**: OpenAI Responses used for persona synthesis.
6. **Persistence (companion)**: `upsertVirtualGirlfriend(...)` writes companion with `generation_status='generating'`.
7. **Visual profile create**: `createVisualProfile(...)` persists identity pack + source setup.
8. **Prompt construction**: `buildImagePrompt(...)` per capture plan (canonical + gallery variants).
9. **Identity/reference handling**:
   - canonical uses selected portrait data URL as reference if parseable
   - gallery uses downloaded canonical delivery URL as reference
10. **Provider invocation**:
   - canonical/galleries: Ideogram endpoints (`generate` or `remix`)
11. **Provider response parsing**:
   - fetch Ideogram temp URL; download bytes; extract metadata
12. **Storage/CDN writeback**:
   - upload bytes to R2 then Cloudinary
13. **DB writeback**:
   - insert `ai_companion_images`, patch visual profile canonical reference
14. **Status finalize**:
   - setup route sets companion generation status to `ready` or `failed`
15. **Frontend handling**:
   - setup redirects to profile regardless of `imageStatus` if HTTP 200

### Competing paths
- **Portrait candidates:** OpenAI image generation via abstraction (`image-provider.ts`) not shared with setup canonical pipeline.
- **Chat images:** direct Ideogram gallery-from-canonical path in `chat-images.ts`, bypassing abstraction.
- **Admin regenerate:** direct visual-identity regenerate path, bypassing abstraction.

## 4. VIRTUAL GIRLFRIEND SETUP TRACE (click “Generate Companion”)

1. **Client submit handler**: `submit()` in setup-flow posts payload. **Status: confirmed working**.
2. **Payload build**: includes selected portrait data URL + prompt. **Status: confirmed working**.
3. **API route receive**: `/api/virtual-girlfriend/setup`. **Status: confirmed working**.
4. **Validation**: required setup fields enforced. **Status: blocked when missing** (400).
5. **Normalization**: `normalizeSetupInput`. **Status: confirmed working**.
6. **Distinctness gate**: `findDistinctnessConflict` may return 409 with “Generation did not start...”. **Status: blocked pre-generation**.
7. **Persona generation**: OpenAI Responses call. **Status: confirmed working when upstream API available**.
8. **Companion upsert**: sets generation_status generating. **Status: confirmed working**.
9. **Visual profile creation**: `createVisualProfile`. **Status: confirmed working**.
10. **Canonical generation**: Ideogram canonical (with selected portrait reference if parseable data URL). **Status: can fail provider/env/storage**.
11. **Gallery generation**: uses canonical bytes as reference. **Status: can fail after canonical success**.
12. **Persistence**:
   - canonical insert required
   - gallery inserts optional but wrapped; failure throws pack error
   **Status: canonical can persist while gallery stage fails**.
13. **Response payload**:
   - success: `{ok:true,imageStatus:'ready'}`
   - failure path: `{ok:true,imageStatus:'failed',warning:...}` with HTTP 200
   **Status: misleadingly reported to client as generic success path**.
14. **Frontend result handling**:
   - only checks `response.ok`; redirects if 200
   - does not branch on `imageStatus` warning
   **Status: misleadingly reported/not surfaced**.

### Separation of failure classes in setup
- **Pre-generation rejection:** distinctness 409 (generation not started).
- **Provider failure:** Ideogram/OpenAI/storage exceptions -> catch, set generation failed.
- **Persistence failure:** canonical insert/storage/cloudinary errors; or gallery insert errors after canonical success.
- **Moderation/review invisibility:** not gating user-facing profile display currently.
- **Frontend not showing success:** possible if canonical missing or no images yet; fallback statuses can show “preparing”/“failed” inconsistently.

## 5. PROVIDER AUDIT
- **Providers present:** OpenAI + Ideogram.
- **Canonical by surface:**
  - setup canonical/gallery = Ideogram direct (`visual-identity.ts`)
  - chat fresh image = Ideogram direct (`chat-images.ts`)
  - portrait candidates = OpenAI through `image-provider.ts`
- **Is Ideogram only live provider?** No. OpenAI still actively used for portrait candidate generation.
- **Dead/legacy provider branches:** `image-provider.ts` is generic but not used by main setup/chat/regenerate pipeline; mostly legacy abstraction.
- **Request shape consistency:** mixed; setup/chat use typed Ideogram direct contracts, portrait route uses generic abstraction.
- **Response parsing consistency:** Ideogram parser central in `image-ideogram.ts`; OpenAI parser separate in `image-openai.ts`.
- **Retries/timeouts/rate-limit handling:** no explicit retries, timeout wrappers, or provider-specific rate-limit handling found.
- **Error surfacing:**
  - setup route catches and downgrades to `ok:true,imageStatus:'failed'`
  - chat route swallows image errors (`console.error` + `imageAttachment=null`)
- **Provider success but app fail risk:** yes (R2/Cloudinary/DB write failures after provider success).

## 6. IDENTITY-LOCK / CANONICAL REFERENCE AUDIT
- **Setup identity lock establishment:** yes, through visual profile creation + canonical image insertion + `canonical_reference_image_id` set on visual profile.
- **Gallery generation identity continuity:** yes, gallery generated from downloaded canonical bytes.
- **Chat generation identity continuity:** yes for fresh generation path; requires visual profile canonical reference.
- **Bypasses:** chat prefers reusable oldest gallery/canonical first; may skip fresh generation entirely, which can mask canonical-reference problems.
- **Selected portrait usage inconsistency:**
  - setup canonical uses selected portrait data URL when parseable
  - regen uses `source_setup.selectedPortraitImage` only if it is still data URL; otherwise silently falls back to non-reference canonical generation
- **Legacy compatibility:** backfilled visual profiles are recognized in admin UI (`source_setup` empty), indicating mixed historical states.

## 7. BLOCKERS AND SILENT FAILURES (ranked)

### Critical
1. **HTTP 200 on generation failure in setup**
   - **Where:** `src/app/api/virtual-girlfriend/setup/route.ts` catch block
   - **Trigger:** any provider/storage/gallery failure
   - **Symptom:** frontend treats as success and redirects; user may think generation succeeded when status is failed
   - **Impact:** silent failure / misleading UX

2. **Chat image failures are swallowed**
   - **Where:** `src/app/api/virtual-girlfriend/chat/stream/route.ts`
   - **Trigger:** missing canonical, provider failure, storage failure
   - **Symptom:** no image attached; assistant gives natural fallback text; no explicit generation error surfaced
   - **Impact:** appears flaky/non-deterministic

3. **No retry/timeout/rate-limit handling in provider/storage path**
   - **Where:** Ideogram/OpenAI/R2/Cloudinary calls
   - **Trigger:** transient upstream failures
   - **Symptom:** immediate hard fail of setup/chat image path
   - **Impact:** brittle generation reliability

### High
4. **Distinctness pre-gen hard block (409) can prevent any generation despite valid preview**
   - **Where:** setup route + distinctness engine
   - **Trigger:** similarity/name threshold hit
   - **Symptom:** user saw portrait previews but final generate blocked “Generation did not start”
   - **Impact:** major setup funnel blocker

5. **Setup client ignores `imageStatus` in successful HTTP response**
   - **Where:** `src/components/virtual-girlfriend/setup-flow.tsx`
   - **Trigger:** backend returns `{ok:true,imageStatus:'failed'}`
   - **Symptom:** immediate redirect without explicit failed-state handling
   - **Impact:** user confusion and false success signal

6. **Profile soft-status text is same for generating and failed**
   - **Where:** `src/components/virtual-girlfriend/profile-view.tsx`
   - **Trigger:** status failed
   - **Symptom:** says “Additional gallery images are still being prepared.” even on failed
   - **Impact:** state truthfulness break

### Medium
7. **Companion type includes `canonical_reference_image_id` but companion select omits it**
   - **Where:** `types.ts` vs `data.ts companionSelect`
   - **Trigger:** any code expecting companion-level canonical_reference_image_id
   - **Symptom:** always absent on fetched companions
   - **Impact:** contract mismatch / latent bug risk

8. **Moderation/review statuses written but not enforced in consumer image selection**
   - **Where:** image records/profile store moderation fields; curation/display paths ignore them
   - **Symptom:** pending/rejected content still potentially displayed in user surfaces
   - **Impact:** policy/visibility inconsistency

9. **Chat reusable image selection prefers oldest images**
   - **Where:** `pickReusableImage` sorts ascending by created_at
   - **Symptom:** stale repeated images; reduced apparent freshness
   - **Impact:** perceived generation not working / repetitive output

## 8. UI TRUTHFULNESS AUDIT
- **Truthful:** setup 409 message explicitly says generation did not start.
- **Misleading:**
  - setup spinner says creating profile/photos, but backend may return `ok:true` with failed image status and UI silently redirects
  - profile failed state uses same “still being prepared” message as generating
  - chat may show “Picking the perfect photo for you…” optimistically but backend can silently downgrade to text-only
  - voice route hard-blocks on companion status not ready; user may see image in profile but still be blocked if status failed
- **State differentiation quality:** weak between blocked vs failed vs partial success vs preparing.

## 9. DATA / STATE MODEL AUDIT
- **Core image entities:**
  - `ai_companion_visual_profiles`: identity pack, canonical reference, review/moderation metadata
  - `ai_companion_images`: canonical/gallery images with lineage/provider/storage metadata
  - `ai_companions`: generation status and setup metadata
- **Canonical fields in practice:** visual-profile `canonical_reference_image_id` is real canonical anchor for downstream generation.
- **Legacy/ambiguous fields:** companion type advertises `canonical_reference_image_id`, but fetch select does not include it.
- **Required downstream prerequisites:** chat fresh generation requires visual profile + canonical reference image record + delivery URL.
- **Half-states observed in model:**
  - companion generating but no images yet
  - canonical inserted but gallery failed
  - companion status failed but canonical exists
  - pending/rejected canonical review with images still displayed

## 10. LEGACY / DUPLICATE / DEAD CODE
1. **`image-provider.ts` abstraction mostly bypassed**
   - setup/chat/regenerate call provider-specific functions directly
   - only portrait-candidates uses abstraction
   - risks drift in contracts and provider behavior

2. **Admin canonical-review API route appears duplicate/unused**
   - admin overview uses server actions + data funcs directly
   - no in-repo callsites to API route discovered

3. **Companion-level canonical_reference_image_id in type likely legacy contract residue**
   - not selected from DB in companion queries
   - canonical truth now lives in visual profile

## 11. TOP 5 ROOT CAUSES
1. Fragmented image architecture with multiple non-unified provider paths (OpenAI seed vs Ideogram main).
2. Error contract mismatch: setup returns HTTP 200 on generation failure while frontend treats all 200 as success.
3. Distinctness gate blocks generation pre-provider, causing preview-then-block experience.
4. Silent degradation in chat image flow (errors swallowed, fallback text), hiding operational failures.
5. State/UX truthfulness issues: failed and generating states are conflated across profile/chat surfaces.

## 12. FIX PLAN (no code yet)
1. **Unify contracts first:** standardize generation result contract across setup/chat/admin with explicit states (`blocked_pre_gen`, `provider_failed`, `persist_failed`, `partial_success`, `ready`).
2. **Correct setup response semantics:** stop returning undifferentiated success for failed generation and make client branch on backend image status.
3. **Centralize provider orchestration:** route setup/chat/regenerate through one provider service layer with retries/timeouts/rate-limit handling.
4. **Enforce canonical identity prerequisites:** explicit checks + structured error codes when canonical reference is missing/broken.
5. **Make UI status truthful:** distinct copy/UI for blocked vs failed vs generating vs moderated/pending-review.
6. **Moderation/review policy alignment:** define if pending/rejected images are user-visible and enforce consistently in curation/display queries.
7. **Remove/merge legacy paths:** consolidate `image-provider.ts` usage and decide fate of unused admin API route.

## 13. CONFIDENCE NOTES
- **Confirmed (code-backed):** setup 409 pre-gen blocks, setup 200-on-failure contract, swallowed chat image errors, provider path fragmentation, moderation fields written-but-not-enforced in user display logic, companion select/type mismatch.
- **Probable but environment-dependent:** operational frequency/severity of provider/network/storage failures and any external rate-limit impacts (no runtime telemetry in this audit).
