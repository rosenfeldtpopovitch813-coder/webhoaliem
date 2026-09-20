'use strict';

/*
 * One-time, additive migration helper.
 * It never deletes legacy data and never credits study time from legacy cursors.
 * Run only after exporting a Firebase backup and reviewing the dry-run report.
 */
const fs = require('fs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const MARKER = 'htvvm-security-v1';
const MAX_WALLET = 10_000_000;

function admin() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !process.env.FIREBASE_DATABASE_URL) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_DATABASE_URL are required.');
  }
  const credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  const app = getApps()[0] || initializeApp({ credential, databaseURL: process.env.FIREBASE_DATABASE_URL });
  return getDatabase(app);
}

function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  return null;
}

function buildMigration(user) {
  const patch = {};
  const existingWallet = user.wallet && typeof user.wallet === 'object' ? user.wallet : null;

  // Only lift an old scalar token balance when the new wallet does not exist.
  // Supported legacy names are explicit and conservative; unknown data is left untouched.
  if (!existingWallet) {
    const legacyBalance = numberOrNull(user.tokenBalance ?? user.tokens ?? user.legacyToken);
    if (legacyBalance !== null && legacyBalance <= MAX_WALLET) {
      patch.wallet = {
        balance: legacyBalance,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        updatedAt: Date.now(),
        migratedFrom: 'legacy-token-balance'
      };
      patch.tokenLedger = {
        [`migration-${Date.now()}`]: {
          type: 'adjustment',
          amount: legacyBalance,
          source: 'migration',
          sourceId: MARKER,
          reason: 'Legacy token balance imported without inventing historical rewards',
          createdAt: Date.now()
        }
      };
    }
  }

  // Archive legacy study cursors for forensic/reference use. Never turn them into trusted time.
  if ((user._studySessions || user._studyClock) && !user.legacyArchive?.[MARKER]) {
    patch.legacyArchive = {
      ...(user.legacyArchive || {}),
      [MARKER]: {
        studySessions: user._studySessions || null,
        studyClock: user._studyClock || null,
        archivedAt: Date.now(),
        note: 'Legacy study cursors archived; not automatically credited.'
      }
    };
  }

  if (!user.migrationMarkers?.[MARKER]) {
    patch.migrationMarkers = {
      ...(user.migrationMarkers || {}),
      [MARKER]: { migratedAt: Date.now() }
    };
  }

  return patch;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const db = admin();
  const root = await db.ref('users').once('value');
  const users = root.val() || {};
  const report = { marker: MARKER, dryRun, users: 0, changed: 0, walletImports: 0, archivedStudyCursors: 0, errors: [] };

  for (const [uid, user] of Object.entries(users)) {
    report.users++;
    const patch = buildMigration(user || {});
    if (!Object.keys(patch).length) continue;
    report.changed++;
    if (patch.wallet) report.walletImports++;
    if (patch.legacyArchive) report.archivedStudyCursors++;
    if (!dryRun) {
      try { await db.ref(`users/${uid}`).update(patch); }
      catch (error) { report.errors.push({ uid, error: error.message }); }
    }
  }

  fs.writeFileSync('docs/migration-last-run.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exit(1); });
