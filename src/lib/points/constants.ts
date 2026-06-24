/*
 * Points economy constants.
 *
 * These mirror the authoritative server-side values defined in
 * supabase/migrations/019_points_economy.sql. The SQL functions are the source
 * of truth for actual spends/grants (so a tampered client cannot change costs);
 * these values are for UI display and gating logic only — keep them in sync.
 */
export const POINTS = {
  /** Cost in points to permanently unblur one gallery photo. */
  unblurCost: 15,
  /** Points granted to an active-premium member once per billing period. */
  premiumMonthlyStipend: 300,
  /** Number of photos visible for free (the canonical / main portrait). */
  freePreviewCount: 1,
} as const;
