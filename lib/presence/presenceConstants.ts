/** Active if `updated_at` is within this window while server says online. */
export const ONLINE_UPDATED_MS = 90_000;
/** Treat as online if last_seen is this fresh (even if is_online lagged). */
export const ONLINE_LAST_SEEN_MS = 60_000;
/** “Active recently” upper bound (fuzzy; no exact timestamps shown). */
export const RECENT_LAST_SEEN_MS = 15 * 60_000;
/** Typing signal TTL for subscribers. */
export const TYPING_STALE_MS = 4_000;
