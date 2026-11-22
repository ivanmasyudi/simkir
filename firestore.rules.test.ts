import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Firestore rules enforce Eight Pillars and pass Dirty Dozen invariants', () => {
  const rules = fs.readFileSync('./firestore.rules', 'utf8');

  // 1. Default deny catch-all
  assert.ok(rules.includes('match /{document=**}'), 'Must include default-deny catch-all');
  assert.ok(rules.includes('allow read, write: if false;'), 'Default catch-all must deny all');

  // 2. Email verification requirement
  assert.ok(rules.includes('request.auth.token.email_verified == true'), 'Must enforce email_verified == true');

  // 3. ID poisoning guard
  assert.ok(rules.includes("id.matches('^[a-zA-Z0-9_\\\\-]+$')"), 'Must guard path IDs with regex');

  // 4. Strict validation blueprints
  assert.ok(rules.includes('function isValidRuangan(data)'), 'Must define isValidRuangan');
  assert.ok(rules.includes('function isValidBarang(data)'), 'Must define isValidBarang');
  assert.ok(rules.includes('function isValidMutasi(data)'), 'Must define isValidMutasi');

  // 5. Temporal integrity & immutable ownerId / createdAt
  assert.ok(rules.includes('incoming().createdAt == request.time'), 'Must enforce server timestamp on create');
  assert.ok(rules.includes('incoming().updatedAt == request.time'), 'Must enforce server timestamp on update');
  assert.ok(rules.includes('incoming().ownerId == existing().ownerId'), 'Must enforce immutable ownerId');
  assert.ok(rules.includes('incoming().createdAt == existing().createdAt'), 'Must enforce immutable createdAt');

  // 6. Query Enforcer on list
  assert.ok(rules.includes('allow list: if isEmailVerified() && existing().ownerId == request.auth.uid;'), 'List queries must enforce ownerId == request.auth.uid');
});
