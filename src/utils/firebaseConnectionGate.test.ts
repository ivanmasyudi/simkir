import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyServerProbeError,
  classifyUserDbError,
  isValidFirebaseConfig,
  resolveAppGateStatus,
} from './firebaseConnectionGate';

test('isValidFirebaseConfig accepts valid config and rejects empty or placeholder configs', () => {
  assert.equal(
    isValidFirebaseConfig({
      apiKey: 'AIzaTestKey123',
      projectId: 'gen-lang-client-0292241941',
      appId: '1:9026:web:abc',
      firestoreDatabaseId: 'ai-studio-24b6bb6a-01b3-4632-9840-29d3fdab5f20',
    }),
    true
  );

  assert.equal(
    isValidFirebaseConfig({
      apiKey: 'AIzaTestKey123',
      projectId: 'remixed-project-id',
      appId: '1:9026:web:abc',
      firestoreDatabaseId: 'default',
    }),
    false
  );

  assert.equal(
    isValidFirebaseConfig({
      apiKey: '',
      projectId: 'my-proj',
      appId: '1:1:web:1',
      firestoreDatabaseId: 'db1',
    }),
    false
  );
});

test('classifyServerProbeError treats permission-denied as server reachable and offline/unavailable as unreachable', () => {
  const permRes = classifyServerProbeError({
    code: 'permission-denied',
    message: 'Missing or insufficient permissions.',
  });
  assert.equal(permRes.serverReachable, true);
  assert.equal(permRes.reason, null);

  const offlineRes = classifyServerProbeError(
    new Error('Failed to get document because the client is offline.')
  );
  assert.equal(offlineRes.serverReachable, false);
  assert.ok(offlineRes.reason?.includes('Tidak dapat menjangkau server'));

  const quotaRes = classifyServerProbeError({
    code: 'resource-exhausted',
    message: 'Quota exceeded.',
  });
  assert.equal(quotaRes.serverReachable, false);
  assert.ok(quotaRes.reason?.includes('Kuota harian'));
});

test('classifyUserDbError returns specific Indonesian guidance for permission, offline, and quota errors', () => {
  assert.ok(
    classifyUserDbError({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions',
    }).includes('ditolak')
  );
  assert.ok(
    classifyUserDbError({
      code: 'unavailable',
      message: 'Service unavailable',
    }).includes('terputus')
  );
  assert.ok(
    classifyUserDbError(new Error('Quota exceeded')).includes('Kuota harian')
  );
});

test('resolveAppGateStatus strictly blocks app usage unless ALL Firebase checks pass', () => {
  // 1. Invalid config -> disconnected & locked
  const invalidCfg = resolveAppGateStatus({
    configValid: false,
    isOnline: true,
    authReady: true,
    hasUser: true,
    serverProbeStatus: 'ok',
    userDbStatus: 'ok',
    errorMessage: null,
  });
  assert.equal(invalidCfg.status, 'disconnected');
  assert.equal(invalidCfg.canUseApp, false);

  // 2. Offline browser -> disconnected & locked even if user previously signed in
  const offline = resolveAppGateStatus({
    configValid: true,
    isOnline: false,
    authReady: true,
    hasUser: true,
    serverProbeStatus: 'ok',
    userDbStatus: 'ok',
    errorMessage: null,
  });
  assert.equal(offline.status, 'disconnected');
  assert.equal(offline.canUseApp, false);

  // 3. Server probe still checking -> checking & locked
  const checking = resolveAppGateStatus({
    configValid: true,
    isOnline: true,
    authReady: true,
    hasUser: false,
    serverProbeStatus: 'checking',
    userDbStatus: 'idle',
    errorMessage: null,
  });
  assert.equal(checking.status, 'checking');
  assert.equal(checking.canUseApp, false);

  // 4. Server probe failed -> disconnected & locked
  const probeErr = resolveAppGateStatus({
    configValid: true,
    isOnline: true,
    authReady: true,
    hasUser: false,
    serverProbeStatus: 'error',
    userDbStatus: 'idle',
    errorMessage: 'Server unreachable',
  });
  assert.equal(probeErr.status, 'disconnected');
  assert.equal(probeErr.canUseApp, false);
  assert.equal(probeErr.detail, 'Server unreachable');

  // 5. Server reachable but user not logged in -> unauthenticated & locked
  const unauth = resolveAppGateStatus({
    configValid: true,
    isOnline: true,
    authReady: true,
    hasUser: false,
    serverProbeStatus: 'ok',
    userDbStatus: 'idle',
    errorMessage: null,
  });
  assert.equal(unauth.status, 'unauthenticated');
  assert.equal(unauth.canUseApp, false);

  // 6. User logged in but user DB verification failed -> disconnected & locked
  const userDbErr = resolveAppGateStatus({
    configValid: true,
    isOnline: true,
    authReady: true,
    hasUser: true,
    serverProbeStatus: 'ok',
    userDbStatus: 'error',
    errorMessage: 'Permission denied',
  });
  assert.equal(userDbErr.status, 'disconnected');
  assert.equal(userDbErr.canUseApp, false);

  // 7. All checks ok -> connected & unlocked
  const connected = resolveAppGateStatus({
    configValid: true,
    isOnline: true,
    authReady: true,
    hasUser: true,
    serverProbeStatus: 'ok',
    userDbStatus: 'ok',
    errorMessage: null,
  });
  assert.equal(connected.status, 'connected');
  assert.equal(connected.canUseApp, true);
});
