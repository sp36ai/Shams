/**
 * Firestore Security Rules — Unit Tests
 *
 * Run:
 *   npx jest firestore.rules.test.ts
 *
 * Requires the Firestore emulator running on port 8282 (as configured in firebase.json).
 * Start it with: firebase emulators:start --only firestore
 *
 * Install dev deps if missing:
 *   npm install --save-dev @firebase/rules-unit-testing firebase
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'shams-app-4d0e7';
const RULES_PATH = path.resolve(__dirname, 'firestore.rules');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: 'localhost',
      port: 8282,
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ── /users/{userId} ──────────────────────────────────────────────────────────

describe('/users/{userId}', () => {
  it('owner can read own user doc', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({ displayName: 'Alice' });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(db.collection('users').doc('alice').get());
  });

  it('other user CANNOT read someone else\'s doc', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({ displayName: 'Alice' });
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertFails(db.collection('users').doc('alice').get());
  });

  it('unauthenticated user CANNOT read any user doc', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({ displayName: 'Alice' });
    });
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('users').doc('alice').get());
  });

  it('owner can create own user doc without privileged fields', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(
      db.collection('users').doc('alice').set({ displayName: 'Alice', preferences: {} }),
    );
  });

  it('owner CANNOT create doc with privileged field "plan"', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      db.collection('users').doc('alice').set({ displayName: 'Alice', plan: 'premium' }),
    );
  });

  it('owner CANNOT create doc with privileged field "admin"', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      db.collection('users').doc('alice').set({ displayName: 'Alice', admin: true }),
    );
  });

  it('owner CANNOT update doc to set isPremium', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('users').doc('alice').set({ displayName: 'Alice' });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('users').doc('alice').update({ isPremium: true }));
  });
});

// ── /quotas/{userId} ─────────────────────────────────────────────────────────

describe('/quotas/{userId}', () => {
  it('owner can read own quota', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('quotas').doc('alice').set({ plan: 'free', used: 1 });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(db.collection('quotas').doc('alice').get());
  });

  it('other user CANNOT read quota', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('quotas').doc('alice').set({ plan: 'free', used: 1 });
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertFails(db.collection('quotas').doc('alice').get());
  });

  it('owner CANNOT write quota (Admin SDK only)', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('quotas').doc('alice').set({ plan: 'premium', used: 0 }));
  });

  it('unauthenticated user CANNOT write quota', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('quotas').doc('alice').set({ plan: 'free', used: 0 }));
  });
});

// ── /readings/{readingId} ────────────────────────────────────────────────────

describe('/readings/{readingId}', () => {
  it('owner can read own reading', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx
        .firestore()
        .collection('readings')
        .doc('r1')
        .set({ userId: 'alice', question: 'test?' });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(db.collection('readings').doc('r1').get());
  });

  it('other user CANNOT read a reading', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx
        .firestore()
        .collection('readings')
        .doc('r1')
        .set({ userId: 'alice', question: 'test?' });
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertFails(db.collection('readings').doc('r1').get());
  });

  it('client CANNOT create a reading (Cloud Functions only)', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      db.collection('readings').doc('r2').set({ userId: 'alice', question: 'test?' }),
    );
  });

  it('owner can delete own reading', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx
        .firestore()
        .collection('readings')
        .doc('r3')
        .set({ userId: 'alice', question: 'test?' });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(db.collection('readings').doc('r3').delete());
  });

  it('other user CANNOT delete someone else\'s reading', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx
        .firestore()
        .collection('readings')
        .doc('r4')
        .set({ userId: 'alice', question: 'test?' });
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertFails(db.collection('readings').doc('r4').delete());
  });
});

// ── /rateLimits ──────────────────────────────────────────────────────────────

describe('/rateLimits', () => {
  it('authenticated user CANNOT read rate limit docs', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      db.collection('rateLimits').doc('alice').collection('minutes').doc('2026-01-01T10:00').get(),
    );
  });

  it('authenticated user CANNOT write rate limit docs', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(
      db
        .collection('rateLimits')
        .doc('alice')
        .collection('minutes')
        .doc('2026-01-01T10:00')
        .set({ count: 1 }),
    );
  });
});

// ── /auditLogs ───────────────────────────────────────────────────────────────

describe('/auditLogs', () => {
  it('regular user CANNOT read audit logs', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('auditLogs').doc('log1').set({ userId: 'alice', action: 'oracle_computed' });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('auditLogs').doc('log1').get());
  });

  it('admin user can read audit logs', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('auditLogs').doc('log1').set({ userId: 'alice', action: 'oracle_computed' });
    });
    const db = testEnv.authenticatedContext('admin1', { token: { admin: true } }).firestore();
    await assertSucceeds(db.collection('auditLogs').doc('log1').get());
  });

  it('even admin CANNOT write audit logs directly', async () => {
    const db = testEnv.authenticatedContext('admin1', { token: { admin: true } }).firestore();
    await assertFails(
      db.collection('auditLogs').doc('log2').set({ action: 'oracle_computed' }),
    );
  });
});

// ── /securityEvents ──────────────────────────────────────────────────────────

describe('/securityEvents', () => {
  it('regular user CANNOT read security events', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('securityEvents').doc('ev1').set({ type: 'test' });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('securityEvents').doc('ev1').get());
  });

  it('admin can read security events', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('securityEvents').doc('ev1').set({ type: 'test' });
    });
    const db = testEnv.authenticatedContext('admin1', { token: { admin: true } }).firestore();
    await assertSucceeds(db.collection('securityEvents').doc('ev1').get());
  });
});

// ── /_system ─────────────────────────────────────────────────────────────────

describe('/_system', () => {
  it('regular user CANNOT read _system config', async () => {
    await testEnv.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().collection('_system').doc('config').set({ maintenanceMode: false });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('_system').doc('config').get());
  });

  it('admin can read and write _system config', async () => {
    const db = testEnv.authenticatedContext('admin1', { token: { admin: true } }).firestore();
    await assertSucceeds(db.collection('_system').doc('config').set({ maintenanceMode: false }));
    await assertSucceeds(db.collection('_system').doc('config').get());
  });
});

// ── Catch-all deny ────────────────────────────────────────────────────────────

describe('catch-all deny', () => {
  it('any unknown collection is denied for authenticated users', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('unknownCollection').doc('doc1').get());
    await assertFails(db.collection('unknownCollection').doc('doc1').set({ data: 1 }));
  });
});
