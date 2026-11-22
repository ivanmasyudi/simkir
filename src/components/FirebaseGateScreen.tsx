import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { GateResolution, ProbeStatus } from '../utils/firebaseConnectionGate';

interface FirebaseGateScreenProps {
  gate: GateResolution;
  isOnline: boolean;
  serverProbeStatus: ProbeStatus;
  userDbStatus: ProbeStatus;
  userEmail: string | null;
  authError: string | null;
  isSigningIn: boolean;
  isRetrying: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onRetryConnection: () => void;
}

export const FirebaseGateScreen: React.FC<FirebaseGateScreenProps> = ({
  gate,
  isOnline,
  serverProbeStatus,
  userDbStatus,
  userEmail,
  authError,
  isSigningIn,
  isRetrying,
  onSignIn,
  onSignOut,
  onRetryConnection,
}) => {
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);

  const isChecking = gate.status === 'checking';
  const isUnauth = gate.status === 'unauthenticated';
  const isDisconnected = gate.status === 'disconnected';

  const headingText = isChecking
    ? 'Menyiapkan Aplikasi...'
    : isUnauth
    ? 'Masuk ke SIMKIR'
    : 'Aplikasi Belum Terhubung ke Database';

  const subtitleText = isChecking
    ? 'Mohon tunggu sebentar, sedang memeriksa koneksi server.'
    : isUnauth
    ? 'Silakan masuk menggunakan akun Google Anda untuk membuka dan mengelola data Kartu Inventaris Ruangan.'
    : gate.detail;

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-stone-900 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-lg p-8 space-y-6">
        {/* Clean Institutional Wordmark */}
        <div className="border-b border-stone-200 pb-5">
          <div className="text-xl font-bold tracking-tight text-[#0F5C4D] font-display">
            SIMKIR
          </div>
          <div className="text-sm text-stone-600 mt-0.5">
            Sistem Informasi Kartu Inventaris Ruangan
          </div>
        </div>

        {/* Calm, Large, Readable Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-stone-900 leading-snug">
            {headingText}
          </h1>
          <p className="text-[15px] text-stone-600 leading-relaxed">
            {subtitleText}
          </p>
        </div>

        {/* Error Box (only if sign-in failed) */}
        {authError && (
          <div
            role="alert"
            className="p-3.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-800"
          >
            {authError}
          </div>
        )}

        {/* Primary Action */}
        <div className="space-y-3 pt-1">
          {isChecking && (
            <div className="flex items-center justify-center gap-2.5 py-3 text-[15px] text-stone-600">
              <Loader2 className="w-5 h-5 animate-spin text-[#0F5C4D]" />
              <span>Memeriksa koneksi...</span>
            </div>
          )}

          {isUnauth && (
            <button
              type="button"
              onClick={onSignIn}
              disabled={isSigningIn || !isOnline}
              className="w-full py-3 px-4 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSigningIn ? 'Membuka Halaman Login Google...' : 'Masuk dengan Akun Google'}
            </button>
          )}

          {isDisconnected && (
            <>
              <button
                type="button"
                onClick={onRetryConnection}
                disabled={isRetrying}
                className="w-full py-3 px-4 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isRetrying ? 'Menghubungkan Ulang...' : 'Coba Hubungkan Kembali'}
              </button>

              {userEmail && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full py-2.5 px-4 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 transition-colors cursor-pointer"
                >
                  Keluar & Ganti Akun Google
                </button>
              )}
            </>
          )}
        </div>

        {/* Discreet Collapsible Pengaturan Koneksi (kept out of the way by default) */}
        <div className="border-t border-stone-200 pt-4">
          <button
            type="button"
            onClick={() => setShowConnectionSettings((prev) => !prev)}
            aria-expanded={showConnectionSettings}
            className="w-full flex items-center justify-between text-sm text-stone-600 hover:text-stone-900 py-1 cursor-pointer"
          >
            <span>Pengaturan & Status Koneksi</span>
            {showConnectionSettings ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showConnectionSettings && (
            <div className="mt-3 pt-3 border-t border-stone-100 space-y-3 text-sm">
              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-stone-500">Jaringan</dt>
                  <dd
                    className={`font-medium ${
                      isOnline ? 'text-[#0F5C4D]' : 'text-red-700'
                    }`}
                  >
                    {isOnline ? 'Online' : 'Offline (Terputus)'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-stone-500">Server Database</dt>
                  <dd
                    className={`font-medium ${
                      serverProbeStatus === 'ok' && isOnline
                        ? 'text-[#0F5C4D]'
                        : serverProbeStatus === 'checking'
                        ? 'text-stone-600'
                        : 'text-red-700'
                    }`}
                  >
                    {serverProbeStatus === 'ok' && isOnline
                      ? 'Terjangkau'
                      : serverProbeStatus === 'checking' || serverProbeStatus === 'idle'
                      ? 'Memeriksa...'
                      : 'Tidak Terjangkau'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-stone-500">Akun</dt>
                  <dd className="font-medium text-stone-800 truncate max-w-[210px]">
                    {userEmail
                      ? userDbStatus === 'error'
                        ? `${userEmail} (Akses ditolak)`
                        : userEmail
                      : 'Belum masuk'}
                  </dd>
                </div>
              </dl>

              {!isChecking && (
                <button
                  type="button"
                  onClick={onRetryConnection}
                  disabled={isRetrying}
                  className="w-full py-2 px-3 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isRetrying ? 'Memeriksa...' : 'Cek Ulang Koneksi Database'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
