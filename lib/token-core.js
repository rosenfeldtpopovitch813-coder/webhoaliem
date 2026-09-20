'use strict';

const TOKEN_LIMIT = 10_000_000;

function asFiniteInt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return NaN;
  const n = value;
  return Number.isSafeInteger(n) ? n : NaN;
}

function validateAmount(value, {max = 100_000} = {}) {
  const amount = asFiniteInt(value);
  if (!Number.isInteger(amount) || amount <= 0 || amount > max) {
    throw Object.assign(new Error('Invalid token amount'), {code: 'INVALID_AMOUNT'});
  }
  return amount;
}

function ensureWallet(wallet) {
  const w = wallet && typeof wallet === 'object' ? wallet : {};
  return {
    balance: Math.max(0, Math.min(TOKEN_LIMIT, Number(w.balance) || 0)),
    lifetimeEarned: Math.max(0, Number(w.lifetimeEarned) || 0),
    lifetimeSpent: Math.max(0, Number(w.lifetimeSpent) || 0),
    updatedAt: Number(w.updatedAt) || 0
  };
}

function applyWallet(wallet, delta, now) {
  const w = ensureWallet(wallet);
  const amount = asFiniteInt(delta);
  if (!Number.isSafeInteger(amount) || amount === 0) throw new Error('Invalid token delta');
  const next = w.balance + amount;
  if (next < 0) throw Object.assign(new Error('Insufficient token balance'), {code: 'INSUFFICIENT_BALANCE'});
  if (next > TOKEN_LIMIT) throw Object.assign(new Error('Token balance exceeds limit'), {code: 'BALANCE_LIMIT'});
  w.balance = next;
  if (amount > 0) w.lifetimeEarned += amount;
  else w.lifetimeSpent += Math.abs(amount);
  w.updatedAt = now;
  return w;
}

function rewardFromTotal(totalStudySeconds, rewardEvery = 3600, rewardAmount = 50) {
  const total = Math.max(0, Math.floor(Number(totalStudySeconds) || 0));
  return Math.floor(total / rewardEvery) * rewardAmount;
}

module.exports = {TOKEN_LIMIT, validateAmount, ensureWallet, applyWallet, rewardFromTotal};
