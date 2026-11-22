export interface FirebaseConfigLike {
  apiKey?: string;
  projectId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

export type ProbeStatus = 'idle' | 'checking' | 'ok' | 'error';

export type AppGateStatus =
  | 'checking'
  | 'unauthenticated'
  | 'disconnected'
  | 'connected';

export interface ServerProbeClassification {
  serverReachable: boolean;
  reason: string | null;
}

export interface GateResolutionInput {
  configValid: boolean;
  isOnline: boolean;
  authReady: boolean;
  hasUser: boolean;
  serverProbeStatus: ProbeStatus;
  userDbStatus: ProbeStatus;
  errorMessage: string | null;
}

export interface GateResolution {
  status: AppGateStatus;
  canUseApp: boolean;
  title: string;
  detail: string;
}

const PLACEHOLDER_PROJECT_IDS = new Set([
  '',
  'remixed-project-id',
  'your-project-id',
]);

export function isValidFirebaseConfig(config: FirebaseConfigLike | null | undefined): boolean {
  if (!config) return false;
  const apiKey = (config.apiKey ?? '').trim();
  const projectId = (config.projectId ?? '').trim();
  const appId = (config.appId ?? '').trim();
  const dbId = (config.firestoreDatabaseId ?? '').trim();

  if (!apiKey || !projectId || !appId || !dbId) return false;
  if (PLACEHOLDER_PROJECT_IDS.has(projectId.toLowerCase())) return false;
  return true;
}

function extractErrorCodeAndMessage(error: unknown): {
  code: string;
  message: string;
} {
  if (error && typeof error === 'object') {
    const code =
      'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code.toLowerCase()
        : '';
    const message =
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error);
    return { code, message };
  }
  return { code: '', message: String(error ?? '') };
}

/**
 * Classifies the result of the startup `getDocFromServer(doc(db, 'test', 'connection'))` probe.
 * A `permission-denied` response comes directly from the live Firestore server, proving
 * the server is reachable and accepting requests even before Google Sign-In.
 */
export function classifyServerProbeError(error: unknown): ServerProbeClassification {
  const { code, message } = extractErrorCodeAndMessage(error);
  const lowerMsg = message.toLowerCase();

  if (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    lowerMsg.includes('missing or insufficient permissions')
  ) {
    return { serverReachable: true, reason: null };
  }

  if (
    code === 'resource-exhausted' ||
    lowerMsg.includes('quota exceeded')
  ) {
    return {
      serverReachable: false,
      reason:
        'Kuota harian database Firebase Firestore telah terlampaui. Kuota akan direset besok atau tingkatkan paket di Firebase Console.',
    };
  }

  if (
    code === 'not-found' ||
    (lowerMsg.includes('database') && lowerMsg.includes('not found'))
  ) {
    return {
      serverReachable: false,
      reason:
        'Database Firestore tidak ditemukan. Pastikan konfigurasi Project ID dan Database ID Firebase sudah benar.',
    };
  }

  if (
    code === 'unavailable' ||
    lowerMsg.includes('client is offline') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('failed to fetch')
  ) {
    return {
      serverReachable: false,
      reason:
        'Tidak dapat menjangkau server database Firebase Firestore. Periksa koneksi internet Anda lalu coba hubungkan ulang.',
    };
  }

  return {
    serverReachable: false,
    reason: `Gagal terhubung ke server Firebase Firestore: ${message || 'Kesalahan tidak diketahui.'}`,
  };
}

/**
 * Classifies errors when verifying or subscribing to authenticated user Firestore collections.
 */
export function classifyUserDbError(error: unknown): string {
  const { code, message } = extractErrorCodeAndMessage(error);
  const lowerMsg = message.toLowerCase();

  if (
    code === 'resource-exhausted' ||
    lowerMsg.includes('quota exceeded')
  ) {
    return 'Kuota harian database Firebase Firestore terlampaui. Aplikasi dikunci hingga kuota tersedia kembali.';
  }

  if (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    lowerMsg.includes('missing or insufficient permissions')
  ) {
    return 'Akses ke database Firebase Firestore ditolak (permission-denied). Pastikan akun Google Anda terverifikasi dan aturan Firestore aktif.';
  }

  if (
    code === 'unavailable' ||
    lowerMsg.includes('client is offline') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('timeout')
  ) {
    return 'Koneksi ke database Firebase Firestore terputus atau server sedang tidak dapat dijangkau.';
  }

  return `Gagal memverifikasi koneksi database Firebase: ${message || 'Kesalahan tidak diketahui.'}`;
}

/**
 * Strictly determines whether the application is allowed to run.
 * `canUseApp` is true ONLY when Firebase config is valid, browser is online,
 * Firestore server is reachable, user is authenticated, AND live Firestore user DB access succeeded.
 */
export function resolveAppGateStatus(input: GateResolutionInput): GateResolution {
  if (!input.configValid) {
    return {
      status: 'disconnected',
      canUseApp: false,
      title: 'Aplikasi Tidak Dapat Digunakan — Konfigurasi Firebase Tidak Valid',
      detail:
        'Konfigurasi Firebase Project atau Database ID belum terpasang dengan benar sehingga aplikasi tidak dapat terhubung ke Firestore.',
    };
  }

  if (!input.isOnline) {
    return {
      status: 'disconnected',
      canUseApp: false,
      title: 'Aplikasi Terkunci — Koneksi Internet / Firebase Terputus',
      detail:
        'Perangkat sedang offline. Aplikasi SIMKIR memerlukan koneksi aktif ke database Firebase Firestore agar dapat digunakan.',
    };
  }

  if (
    !input.authReady ||
    input.serverProbeStatus === 'idle' ||
    input.serverProbeStatus === 'checking'
  ) {
    return {
      status: 'checking',
      canUseApp: false,
      title: 'Memeriksa Koneksi Database Firebase...',
      detail:
        'Sedang memverifikasi koneksi langsung ke server Firebase Firestore sebelum membuka aplikasi.',
    };
  }

  if (input.serverProbeStatus === 'error') {
    return {
      status: 'disconnected',
      canUseApp: false,
      title: 'Aplikasi Tidak Dapat Digunakan — Gagal Terhubung ke Firebase',
      detail:
        input.errorMessage ||
        'Server database Firebase Firestore tidak dapat dijangkau. Aplikasi dikunci sampai koneksi berhasil.',
    };
  }

  if (!input.hasUser) {
    return {
      status: 'unauthenticated',
      canUseApp: false,
      title: 'Aplikasi Terkunci — Hubungkan ke Database Firebase',
      detail:
        'Server Firebase Firestore siap, namun Anda belum login. Masuk dengan akun Google untuk terhubung ke database dan menggunakan SIMKIR.',
    };
  }

  if (input.userDbStatus === 'idle' || input.userDbStatus === 'checking') {
    return {
      status: 'checking',
      canUseApp: false,
      title: 'Menghubungkan Akun ke Database Firebase...',
      detail:
        'Memverifikasi akses baca/tulis langsung pada koleksi Firestore untuk akun Anda.',
    };
  }

  if (input.userDbStatus === 'error') {
    return {
      status: 'disconnected',
      canUseApp: false,
      title: 'Aplikasi Tidak Dapat Digunakan — Koneksi Database Firebase Gagal',
      detail:
        input.errorMessage ||
        'Gagal membaca data dari server Firebase Firestore. Pastikan jaringan stabil dan akun memiliki izin akses.',
    };
  }

  return {
    status: 'connected',
    canUseApp: true,
    title: 'Terhubung ke Database Firebase Firestore',
    detail: 'Seluruh data tersinkronisasi langsung secara real-time dengan Firestore.',
  };
}
