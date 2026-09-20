'use strict';

/**
 * Firebase RTDB backed rate limiter. It is intentionally conservative and
 * server-side; clients cannot reset it by changing localStorage.
 */
async function consumeRateLimit(db, key, {limit = 60, windowMs = 60_000} = {}) {
  const safeKey = String(key).replace(/[^A-Za-z0-9:_-]/g, '_').slice(0, 220);
  const now = Date.now();
  const ref = db.ref(`apiRateLimits/${safeKey}`);
  const tx = await ref.transaction(current => {
    const state = current && typeof current === 'object' ? current : null;
    if (!state || now - Number(state.startedAt || 0) >= windowMs) {
      return { startedAt: now, count: 1, expiresAt: now + windowMs };
    }
    const count = Number(state.count || 0);
    if (count >= limit) return;
    return {...state, count: count + 1, expiresAt: state.expiresAt || now + windowMs};
  });
  return {
    allowed: !!tx.committed,
    count: Number(tx.snapshot?.val()?.count || limit),
    resetAt: Number(tx.snapshot?.val()?.expiresAt || now + windowMs)
  };
}

module.exports = {consumeRateLimit};
