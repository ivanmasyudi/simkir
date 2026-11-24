import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  ArrowRightLeft,
  Building2,
  FileSpreadsheet,
  Layers,
  LayoutDashboard,
  Menu,
  Package,
  QrCode,
  Settings,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  Barang,
  InstansiSetting,
  MasterReferensi,
  Mutasi,
  Ruangan,
} from './types/kir';
import { DEFAULT_INSTANSI_SETTING } from './data/seedData';
import {
  ProbeStatus,
  resolveAppGateStatus,
} from './utils/firebaseConnectionGate';
import { planBarangReassignmentForRoomDelete } from './utils/kirLogic';
import {
  auth,
  createBarangFirestore,
  createMasterReferensiBatchFirestore,
  createMasterReferensiFirestore,
  createRuanganFirestore,
  deleteBarangFirestore,
  deleteMasterReferensiFirestore,
  deleteRuanganFirestore,
  FIREBASE_META,
  reassignBarangAndDeleteRuanganFirestore,
  recordMutasiFirestore,
  resetUserFirestoreData,
  seedInitialDataToFirestore,
  signInWithGoogle,
  signOutUser,
  subscribeMasterReferensi,
  subscribeUserCollections,
  testConnection,
  updateBarangFirestore,
  updateMasterReferensiFirestore,
  updateRuanganFirestore,
  verifyUserFirestoreAccess,
} from './lib/firebase';
import { ResetDataSummary } from './utils/firebaseReset';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirebaseGateScreen } from './components/FirebaseGateScreen';
import { DashboardView } from './components/DashboardView';
import { MasterBarangView } from './components/MasterBarangView';
import { MasterRuanganView } from './components/MasterRuanganView';
import { MasterReferensiView } from './components/MasterReferensiView';
import { MutasiView } from './components/MutasiView';
import { QrLabelPrintView } from './components/QrLabelPrintView';
import { LaporanKirView } from './components/LaporanKirView';
import { SettingsView } from './components/SettingsView';

const INSTANSI_STORAGE_KEY = 'simkir_instansi_v3';

const PAGE_TITLES: Record<ActiveTab, string> = {
  dashboard: 'Beranda',
  barang: 'Data Barang',
  ruangan: 'Daftar Ruangan',
  'master-referensi': 'Master Referensi',
  mutasi: 'Mutasi Barang',
  'qr-label': 'Cetak Label QR',
  laporan: 'Laporan KIR',
  pengaturan: 'Pengaturan',
};

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterRuanganId, setFilterRuanganId] = useState<string>('ALL');
  const [preselectedMutasiBarang, setPreselectedMutasiBarang] =
    useState<Barang | null>(null);
  const [triggerAddBarang, setTriggerAddBarang] = useState(0);
  const [triggerAddMutasi, setTriggerAddMutasi] = useState(0);

  // Strict Firebase Connection & Auth state
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [serverProbeStatus, setServerProbeStatus] =
    useState<ProbeStatus>('checking');
  const [userDbStatus, setUserDbStatus] = useState<ProbeStatus>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [cloudBannerMsg, setCloudBannerMsg] = useState<string | null>(null);
  const [isSeedingCloud, setIsSeedingCloud] = useState(false);
  const [isResettingCloud, setIsResettingCloud] = useState(false);

  // Firestore-backed data state (strictly empty until connected to Firebase)
  const [ruanganList, setRuanganList] = useState<Ruangan[]>([]);
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [mutasiList, setMutasiList] = useState<Mutasi[]>([]);
  const [masterReferensiList, setMasterReferensiList] = useState<
    MasterReferensi[]
  >([]);

  const [instansi, setInstansi] = useState<InstansiSetting>(() => {
    try {
      const saved = localStorage.getItem(INSTANSI_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_INSTANSI_SETTING;
    } catch {
      return DEFAULT_INSTANSI_SETTING;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(INSTANSI_STORAGE_KEY, JSON.stringify(instansi));
    } catch {
      // Ignore storage quota issues
    }
  }, [instansi]);

  // Monitor browser online/offline transitions
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setServerProbeStatus('error');
      setUserDbStatus('error');
      setConnectionError(
        'Koneksi internet terputus. Aplikasi dikunci sampai koneksi ke database Firebase Firestore kembali aktif.'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Probe live Firestore server reachability
  const runServerProbe = useCallback(async () => {
    if (!FIREBASE_META.isConfigValid) {
      setServerProbeStatus('error');
      setConnectionError('Konfigurasi Firebase tidak valid.');
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsOnline(false);
      setServerProbeStatus('error');
      setConnectionError(
        'Perangkat sedang offline. Tidak dapat menghubungi server Firebase.'
      );
      return false;
    }

    setServerProbeStatus('checking');
    setConnectionError(null);
    const res = await testConnection();
    if (res.connected) {
      setServerProbeStatus('ok');
      return true;
    }
    setServerProbeStatus('error');
    setConnectionError(
      res.error || 'Gagal menjangkau server Firebase Firestore.'
    );
    return false;
  }, []);

  // Run initial server probe and re-run whenever connectivity returns
  useEffect(() => {
    if (!isOnline) return;
    runServerProbe();
  }, [isOnline, runServerProbe]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (!user) {
        setUserDbStatus('idle');
        setRuanganList([]);
        setBarangList([]);
        setMutasiList([]);
        setMasterReferensiList([]);
      }
    });
    return () => unsub();
  }, []);

  // Verify live Firestore access for the authenticated user before unlocking the app
  const verifyAuthenticatedDatabase = useCallback(
    async (uid: string) => {
      setUserDbStatus('checking');
      setConnectionError(null);
      const res = await verifyUserFirestoreAccess(uid);
      if (res.connected) {
        setUserDbStatus('ok');
        return true;
      }
      setUserDbStatus('error');
      setConnectionError(
        res.error || 'Gagal memverifikasi akses database Firebase Firestore.'
      );
      return false;
    },
    []
  );

  useEffect(() => {
    if (!authReady || !currentUser || !isOnline || serverProbeStatus !== 'ok') {
      return;
    }
    verifyAuthenticatedDatabase(currentUser.uid);
  }, [
    authReady,
    currentUser,
    isOnline,
    serverProbeStatus,
    verifyAuthenticatedDatabase,
  ]);

  // Subscribe to real-time Firestore collections ONLY once verified connected
  useEffect(() => {
    if (
      !authReady ||
      !currentUser ||
      !isOnline ||
      serverProbeStatus !== 'ok' ||
      userDbStatus !== 'ok'
    ) {
      return;
    }

    const unsub = subscribeUserCollections(currentUser.uid, {
      onRuangan: (items) => setRuanganList(items),
      onBarang: (items) => setBarangList(items),
      onMutasi: (items) => setMutasiList(items),
      onError: (err) => setCloudBannerMsg(err.message),
      onConnectionLost: (reason) => {
        setUserDbStatus('error');
        setConnectionError(reason);
      },
    });

    const unsubMasterRef = subscribeMasterReferensi(currentUser.uid, (items) =>
      setMasterReferensiList(items)
    );

    return () => {
      unsub();
      unsubMasterRef();
    };
  }, [authReady, currentUser, isOnline, serverProbeStatus, userDbStatus]);

  const gate = resolveAppGateStatus({
    configValid: FIREBASE_META.isConfigValid,
    isOnline,
    authReady,
    hasUser: Boolean(currentUser),
    serverProbeStatus,
    userDbStatus,
    errorMessage: connectionError,
  });

  const handleRetryConnection = async () => {
    setIsRetryingConnection(true);
    setAuthError(null);
    try {
      const browserOnline =
        typeof navigator === 'undefined' ? true : navigator.onLine;
      setIsOnline(browserOnline);
      if (!browserOnline) {
        setServerProbeStatus('error');
        setUserDbStatus('error');
        setConnectionError(
          'Perangkat masih offline. Aktifkan koneksi internet lalu coba hubungkan ulang.'
        );
        return;
      }
      const serverOk = await runServerProbe();
      if (serverOk && currentUser) {
        await verifyAuthenticatedDatabase(currentUser.uid);
      }
    } finally {
      setIsRetryingConnection(false);
    }
  };

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Login Google dibatalkan atau gagal.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setCloudBannerMsg(null);
      setAuthError(null);
      await signOutUser();
      setRuanganList([]);
      setBarangList([]);
      setMutasiList([]);
      setMasterReferensiList([]);
      setUserDbStatus('idle');
    } catch (err) {
      setCloudBannerMsg(
        err instanceof Error ? err.message : 'Gagal keluar dari akun Firebase.'
      );
    }
  };

  const ensureFirebaseConnected = (): User => {
    if (!currentUser || !gate.canUseApp) {
      setUserDbStatus('error');
      setConnectionError(
        'Koneksi database Firebase tidak aktif. Operasi dibatalkan dan aplikasi dikunci.'
      );
      throw new Error('Tidak terhubung ke database Firebase Firestore.');
    }
    return currentUser;
  };

  const handleNavigate = (tab: ActiveTab, roomFilter?: string) => {
    if (roomFilter) {
      setFilterRuanganId(roomFilter);
    } else if (tab !== 'barang' && tab !== 'laporan' && tab !== 'qr-label') {
      setFilterRuanganId('ALL');
    }
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // Strict Firestore-only handlers (no local fallback)
  const handleSaveRuangan = async (ruangan: Ruangan, isEdit: boolean) => {
    const user = ensureFirebaseConnected();
    if (isEdit) {
      await updateRuanganFirestore(user.uid, ruangan);
    } else {
      await createRuanganFirestore(user.uid, {
        ...ruangan,
        ownerId: user.uid,
      });
    }
  };

  const handleSaveRuanganBatch = async (records: Ruangan[]) => {
    if (records.length === 0) return;
    const user = ensureFirebaseConnected();
    for (const rec of records) {
      await createRuanganFirestore(user.uid, {
        ...rec,
        ownerId: user.uid,
      });
    }
  };

  const handleDeleteRuangan = async (id: string) => {
    ensureFirebaseConnected();
    const stillHasBarang = barangList.some((b) => b.ruanganId === id);
    if (stillHasBarang) {
      throw new Error(
        'Ruangan masih memiliki data barang. Pindahkan seluruh barang ke sub-ruangan lain terlebih dahulu.'
      );
    }
    await deleteRuanganFirestore(id);
    if (filterRuanganId === id) {
      setFilterRuanganId('ALL');
    }
  };

  const handleReassignAndDeleteRuangan = async (
    targetRuanganId: string,
    destinationRuanganId: string
  ) => {
    const user = ensureFirebaseConnected();
    const targetRuangan = ruanganList.find((r) => r.id === targetRuanganId);
    const destinationRuangan = ruanganList.find(
      (r) => r.id === destinationRuanganId
    );
    if (!targetRuangan || !destinationRuangan) {
      throw new Error('Ruangan asal atau sub-ruangan tujuan tidak ditemukan.');
    }
    const reassignedBarang = planBarangReassignmentForRoomDelete(
      targetRuangan,
      destinationRuangan,
      barangList,
      new Date().toISOString()
    );
    await reassignBarangAndDeleteRuanganFirestore(
      user.uid,
      targetRuangan.id,
      destinationRuangan,
      reassignedBarang
    );
    if (filterRuanganId === targetRuanganId) {
      setFilterRuanganId(destinationRuanganId);
    }
  };

  const handleSaveBarang = async (barang: Barang, isEdit: boolean) => {
    const user = ensureFirebaseConnected();
    const targetRuangan = ruanganList.find((r) => r.id === barang.ruanganId);
    if (isEdit) {
      await updateBarangFirestore(user.uid, barang, targetRuangan);
    } else {
      await createBarangFirestore(
        user.uid,
        {
          ...barang,
          ownerId: user.uid,
        },
        targetRuangan
      );
    }
  };

  const handleSaveBarangBatch = async (records: Barang[]) => {
    if (records.length === 0) return;
    const user = ensureFirebaseConnected();
    for (const rec of records) {
      const targetRuangan = ruanganList.find((r) => r.id === rec.ruanganId);
      await createBarangFirestore(
        user.uid,
        {
          ...rec,
          ownerId: user.uid,
        },
        targetRuangan
      );
    }
  };

  const handleDeleteBarang = async (id: string) => {
    ensureFirebaseConnected();
    await deleteBarangFirestore(id);
  };

  const handleSaveMasterReferensi = async (
    item: MasterReferensi,
    isEdit: boolean
  ) => {
    const user = ensureFirebaseConnected();
    if (isEdit) {
      await updateMasterReferensiFirestore(user.uid, item);
    } else {
      await createMasterReferensiFirestore(user.uid, {
        ...item,
        ownerId: user.uid,
      });
    }
  };

  const handleSaveMasterReferensiBatch = async (items: MasterReferensi[]) => {
    if (items.length === 0) return;
    const user = ensureFirebaseConnected();
    await createMasterReferensiBatchFirestore(
      user.uid,
      items.map((item) => ({ ...item, ownerId: user.uid }))
    );
  };

  const handleDeleteMasterReferensi = async (id: string) => {
    const user = ensureFirebaseConnected();
    await deleteMasterReferensiFirestore(user.uid, id);
  };

  const handleRecordMutasi = async (mutasi: Mutasi) => {
    const user = ensureFirebaseConnected();
    const targetBarang = barangList.find((b) => b.id === mutasi.barangId);
    const ruanganTujuan = ruanganList.find(
      (r) => r.id === mutasi.ruanganTujuanId
    );
    const ruanganAsal = ruanganList.find((r) => r.id === mutasi.ruanganAsalId);
    await recordMutasiFirestore(
      user.uid,
      {
        ...mutasi,
        ownerId: user.uid,
      },
      targetBarang,
      ruanganTujuan,
      ruanganAsal
    );
    setPreselectedMutasiBarang(null);
  };

  const handleSeedCloudData = async () => {
    const user = ensureFirebaseConnected();
    try {
      setIsSeedingCloud(true);
      setCloudBannerMsg(null);
      await seedInitialDataToFirestore(user.uid);
    } catch (err) {
      setCloudBannerMsg(
        err instanceof Error ? err.message : 'Gagal memuat data awal ke cloud.'
      );
      throw err;
    } finally {
      setIsSeedingCloud(false);
    }
  };

  const handleResetCloudData = async (
    alsoResetInstansi: boolean
  ): Promise<ResetDataSummary> => {
    const user = ensureFirebaseConnected();
    try {
      setIsResettingCloud(true);
      setCloudBannerMsg(null);
      const summary = await resetUserFirestoreData(user.uid);
      setFilterRuanganId('ALL');
      setPreselectedMutasiBarang(null);
      if (alsoResetInstansi) {
        setInstansi(DEFAULT_INSTANSI_SETTING);
      }
      return summary;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal mereset data database Firebase.';
      setCloudBannerMsg(msg);
      throw err;
    } finally {
      setIsResettingCloud(false);
    }
  };

  // HARD GATE: Block the entire application when NOT connected to Firebase Firestore
  if (!gate.canUseApp) {
    return (
      <ErrorBoundary>
        <FirebaseGateScreen
          gate={gate}
          isOnline={isOnline}
          serverProbeStatus={serverProbeStatus}
          userDbStatus={userDbStatus}
          userEmail={currentUser?.email ?? null}
          authError={authError}
          isSigningIn={isSigningIn}
          isRetrying={isRetryingConnection}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onRetryConnection={handleRetryConnection}
        />
      </ErrorBoundary>
    );
  }

  const mainNavItems = [
    { id: 'dashboard' as const, label: 'Beranda', icon: LayoutDashboard },
    { id: 'barang' as const, label: 'Data Barang', icon: Package },
    { id: 'ruangan' as const, label: 'Daftar Ruangan', icon: Building2 },
    {
      id: 'master-referensi' as const,
      label: 'Master Referensi',
      icon: Layers,
    },
    { id: 'mutasi' as const, label: 'Mutasi Barang', icon: ArrowRightLeft },
    { id: 'qr-label' as const, label: 'Cetak Label QR', icon: QrCode },
    { id: 'laporan' as const, label: 'Laporan KIR', icon: FileSpreadsheet },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-stone-200 flex items-center justify-between">
        <div>
          <div className="text-xl font-bold tracking-tight text-[#0F5C4D] font-display">
            SIMKIR
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            Kartu Inventaris Ruangan
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu"
          className="lg:hidden p-2 text-stone-600 hover:text-stone-900 rounded-md cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Single, Clear Primary Navigation */}
      <nav aria-label="Menu Utama" className="flex-1 px-3 py-4 space-y-1">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                handleNavigate(
                  item.id,
                  item.id === 'laporan'
                    ? ruanganList[0]?.id || 'ALL'
                    : item.id === 'barang' || item.id === 'qr-label'
                    ? 'ALL'
                    : undefined
                )
              }
              className={`w-full flex items-center gap-3 px-3.5 py-3 text-[15px] rounded-md transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#EBF4F2] text-[#0F5C4D] font-semibold'
                  : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Settings Entry (Database, Account & Instansi live quietly here) */}
      <div className="px-3 py-4 border-t border-stone-200">
        <button
          type="button"
          onClick={() => handleNavigate('pengaturan')}
          className={`w-full flex items-center gap-3 px-3.5 py-3 text-[15px] rounded-md transition-colors text-left cursor-pointer ${
            activeTab === 'pengaturan'
              ? 'bg-[#EBF4F2] text-[#0F5C4D] font-semibold'
              : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900 font-medium'
          }`}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          <span>Pengaturan</span>
        </button>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-[#F6F6F3] text-stone-900">
        {/* Desktop Sidebar (Single Navigation Source) */}
        <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-stone-200 sticky top-0 h-screen no-print">
          {renderSidebarContent()}
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex no-print">
            <div
              className="fixed inset-0 bg-stone-900/40"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-stone-200 z-10">
              {renderSidebarContent()}
            </aside>
          </div>
        )}

        {/* Right Main Column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Calm, Minimal Top Header (No Duplicate Menus, No Loud Badges) */}
          <header className="bg-white border-b border-stone-200 px-5 sm:px-8 py-4 flex items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Buka menu navigasi"
                className="lg:hidden p-2 -ml-2 text-stone-700 hover:bg-stone-100 rounded-md cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <span className="text-base font-semibold text-stone-900 truncate">
                {PAGE_TITLES[activeTab]}
              </span>
            </div>

            <div className="text-sm text-stone-500 truncate max-w-[220px] sm:max-w-md">
              {instansi.unit}
            </div>
          </header>

          {/* Optional Cloud Error Notice */}
          {cloudBannerMsg && (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-900 no-print">
              <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                <span>{cloudBannerMsg}</span>
                <button
                  type="button"
                  onClick={() => setCloudBannerMsg(null)}
                  className="underline font-medium shrink-0 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          )}

          {/* Main Workspace Container */}
          <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 sm:px-8 py-7">
            {activeTab === 'dashboard' && (
              <DashboardView
                barangList={barangList}
                ruanganList={ruanganList}
                mutasiList={mutasiList}
                instansi={instansi}
                onNavigate={handleNavigate}
                onOpenAddBarang={() => {
                  setActiveTab('barang');
                  setTriggerAddBarang((n) => n + 1);
                }}
                onOpenAddMutasi={() => {
                  setActiveTab('mutasi');
                  setTriggerAddMutasi((n) => n + 1);
                }}
              />
            )}

            {activeTab === 'barang' && (
              <MasterBarangView
                barangList={barangList}
                ruanganList={ruanganList}
                instansi={instansi}
                masterReferensiList={masterReferensiList}
                initialFilterRuanganId={filterRuanganId}
                triggerOpenAddModal={triggerAddBarang}
                onSaveBarang={handleSaveBarang}
                onSaveBarangBatch={handleSaveBarangBatch}
                onDeleteBarang={handleDeleteBarang}
                onOpenMutasiForBarang={(barang) => {
                  setPreselectedMutasiBarang(barang);
                  setActiveTab('mutasi');
                }}
              />
            )}

            {activeTab === 'ruangan' && (
              <MasterRuanganView
                ruanganList={ruanganList}
                barangList={barangList}
                onSaveRuangan={handleSaveRuangan}
                onSaveRuanganBatch={handleSaveRuanganBatch}
                onDeleteRuangan={handleDeleteRuangan}
                onReassignAndDeleteRuangan={handleReassignAndDeleteRuangan}
                onNavigateLaporanRuangan={(rId) => handleNavigate('laporan', rId)}
                onNavigateQrRuangan={(rId) => handleNavigate('qr-label', rId)}
              />
            )}

            {activeTab === 'master-referensi' && (
              <MasterReferensiView
                masterList={masterReferensiList}
                ownerId={currentUser?.uid || 'demo-user'}
                onSaveMaster={handleSaveMasterReferensi}
                onSaveMasterBatch={handleSaveMasterReferensiBatch}
                onDeleteMaster={handleDeleteMasterReferensi}
              />
            )}

            {activeTab === 'mutasi' && (
              <MutasiView
                mutasiList={mutasiList}
                barangList={barangList}
                ruanganList={ruanganList}
                instansi={instansi}
                preselectedBarang={preselectedMutasiBarang}
                triggerOpenAddModal={triggerAddMutasi}
                onRecordMutasi={handleRecordMutasi}
              />
            )}

            {activeTab === 'qr-label' && (
              <QrLabelPrintView
                barangList={barangList}
                ruanganList={ruanganList}
                instansi={instansi}
                initialFilterRuanganId={filterRuanganId}
              />
            )}

            {activeTab === 'laporan' && (
              <LaporanKirView
                barangList={barangList}
                ruanganList={ruanganList}
                instansi={instansi}
                initialFilterRuanganId={filterRuanganId}
                onUpdateInstansi={setInstansi}
              />
            )}

            {activeTab === 'pengaturan' && (
              <SettingsView
                instansi={instansi}
                onUpdateInstansi={setInstansi}
                userEmail={currentUser?.email ?? null}
                isSeedingCloud={isSeedingCloud}
                isResettingCloud={isResettingCloud}
                hasExistingData={
                  ruanganList.length > 0 ||
                  barangList.length > 0 ||
                  mutasiList.length > 0
                }
                dataCounts={{
                  ruangan: ruanganList.length,
                  barang: barangList.length,
                  mutasi: mutasiList.length,
                }}
                onSeedCloudData={handleSeedCloudData}
                onResetCloudData={handleResetCloudData}
                onSignOut={handleSignOut}
              />
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
