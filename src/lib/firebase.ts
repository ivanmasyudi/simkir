import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Barang, Mutasi, Ruangan } from '../types/kir';
import {
  INITIAL_BARANG_LIST,
  INITIAL_MUTASI_LIST,
  INITIAL_RUANGAN_LIST,
} from '../data/seedData';
import { KATEGORI_LIST, KONDISI_LIST, sanitizeId } from '../utils/kirLogic';
import {
  classifyServerProbeError,
  classifyUserDbError,
  isValidFirebaseConfig,
} from '../utils/firebaseConnectionGate';
import {
  chunkForFirestoreBatch,
  FIRESTORE_SAFE_BATCH_LIMIT,
  ResetDataSummary,
} from '../utils/firebaseReset';

export const FIREBASE_META = {
  projectId: firebaseConfig.projectId || '',
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || '',
  isConfigValid: isValidFirebaseConfig(firebaseConfig),
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ConnectionCheckResult {
  connected: boolean;
  error: string | null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function testConnection(): Promise<ConnectionCheckResult> {
  if (!FIREBASE_META.isConfigValid) {
    return {
      connected: false,
      error: 'Konfigurasi Firebase tidak valid atau belum lengkap.',
    };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      connected: false,
      error: 'Perangkat sedang offline. Tidak dapat menghubungi server Firebase.',
    };
  }
  try {
    await withTimeout(
      getDocFromServer(doc(db, 'test', 'connection')),
      8000,
      'Timeout menghubungi server Firebase Firestore.'
    );
    return { connected: true, error: null };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
    const classified = classifyServerProbeError(error);
    return {
      connected: classified.serverReachable,
      error: classified.reason,
    };
  }
}

export async function verifyUserFirestoreAccess(
  uid: string
): Promise<ConnectionCheckResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      connected: false,
      error: 'Perangkat sedang offline. Tidak dapat memverifikasi database Firebase.',
    };
  }
  try {
    const verifyQuery = query(
      collection(db, 'ruangan'),
      where('ownerId', '==', uid),
      limit(1)
    );
    await withTimeout(
      getDocsFromServer(verifyQuery),
      8000,
      'Timeout memverifikasi koneksi database Firebase Firestore.'
    );
    return { connected: true, error: null };
  } catch (error) {
    return {
      connected: false,
      error: classifyUserDbError(error),
    };
  }
}

testConnection();

export function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return new Date().toISOString();
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

const migratedDocIds = new Set<string>();

function buildValidRuanganPayload(uid: string, ruangan: Ruangan) {
  return {
    kodeRuangan: (ruangan.kodeRuangan || 'R-KIR-01').trim().slice(0, 32),
    namaRuangan: (ruangan.namaRuangan || 'RUANGAN INVENTARIS').trim().slice(0, 120),
    subRuangan: (ruangan.subRuangan ?? '').trim().slice(0, 120),
    gedung: (ruangan.gedung || 'Gedung Utama').trim().slice(0, 80),
    lantai: (ruangan.lantai || 'Lantai 1').trim().slice(0, 20),
    penanggungJawab: (ruangan.penanggungJawab || 'Penanggung Jawab').trim().slice(0, 100),
    nipPenanggungJawab: (ruangan.nipPenanggungJawab || '-').trim().slice(0, 40),
    unitKerja: (ruangan.unitKerja || 'Instalasi / Unit Kerja').trim().slice(0, 100),
    keterangan: (ruangan.keterangan ?? '').trim().slice(0, 300),
    ownerId: uid,
  };
}

function buildValidBarangPayload(uid: string, barang: Barang) {
  const safeKategori = KATEGORI_LIST.includes(barang.kategori)
    ? barang.kategori
    : 'Alat Ukur & Laboratorium';
  const safeKondisi = KONDISI_LIST.includes(barang.kondisi)
    ? barang.kondisi
    : 'Baik';
  const safeTahun = Math.min(
    2100,
    Math.max(1970, Math.round(Number(barang.tahunPerolehan) || 2024))
  );
  const safeJumlah = Math.min(
    100000,
    Math.max(1, Math.round(Number(barang.jumlah) || 1))
  );

  return {
    kodeBarang: (barang.kodeBarang || '1.3.2.05.02.01.001').trim().slice(0, 50),
    nup: (barang.nup || '0001').trim().slice(0, 20),
    namaBarang: (barang.namaBarang || 'Barang Inventaris').trim().slice(0, 150),
    merkTipe: (barang.merkTipe ?? '').trim().slice(0, 150),
    nomorSeri: (barang.nomorSeri ?? '').trim().slice(0, 100),
    ukuran: (barang.ukuran ?? '').trim().slice(0, 80),
    bahan: ((barang.bahan ?? 'BESI').trim() || 'BESI').slice(0, 80),
    kategori: safeKategori,
    tahunPerolehan: safeTahun,
    sumberDana: ((barang.sumberDana ?? 'BLUD').trim() || 'BLUD').slice(0, 60),
    jumlah: safeJumlah,
    satuan: ((barang.satuan ?? 'UNIT').trim() || 'UNIT').slice(0, 30),
    kondisi: safeKondisi,
    ruanganId: sanitizeId(barang.ruanganId || 'ruang-lab-pa'),
    ruanganNama: (barang.ruanganNama || 'INST. LABORATORIUM').trim().slice(0, 120),
    keterangan: (barang.keterangan ?? '').trim().slice(0, 300),
    ownerId: uid,
  };
}

export function subscribeUserCollections(
  uid: string,
  callbacks: {
    onRuangan: (items: Ruangan[]) => void;
    onBarang: (items: Barang[]) => void;
    onMutasi: (items: Mutasi[]) => void;
    onError?: (err: Error) => void;
    onConnectionLost?: (reason: string) => void;
  }
) {
  const ruanganQuery = query(
    collection(db, 'ruangan'),
    where('ownerId', '==', uid)
  );
  const barangQuery = query(
    collection(db, 'barang'),
    where('ownerId', '==', uid)
  );
  const mutasiQuery = query(
    collection(db, 'mutasi'),
    where('ownerId', '==', uid)
  );

  const unsubRuangan = onSnapshot(
    ruanganQuery,
    (snap) => {
      const list: Ruangan[] = snap.docs.map((d) => {
        const data = d.data();
        const item: Ruangan = {
          id: d.id,
          kodeRuangan: data.kodeRuangan ?? 'R-KIR-01',
          namaRuangan: data.namaRuangan ?? 'RUANGAN INVENTARIS',
          subRuangan: data.subRuangan ?? '',
          gedung: data.gedung ?? 'Gedung Utama',
          lantai: data.lantai ?? 'Lantai 1',
          penanggungJawab: data.penanggungJawab ?? 'Penanggung Jawab',
          nipPenanggungJawab: data.nipPenanggungJawab ?? '-',
          unitKerja: data.unitKerja ?? 'Instalasi',
          keterangan: data.keterangan ?? '',
          ownerId: data.ownerId,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };

        // Migrate legacy v1 Ruangan missing subRuangan
        if (
          typeof data.subRuangan !== 'string' &&
          !migratedDocIds.has(`ruangan/${d.id}`)
        ) {
          migratedDocIds.add(`ruangan/${d.id}`);
          updateDoc(doc(db, 'ruangan', d.id), {
            subRuangan: '',
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }

        return item;
      });
      callbacks.onRuangan(list);
    },
    (error) => {
      callbacks.onConnectionLost?.(classifyUserDbError(error));
      try {
        handleFirestoreError(error, OperationType.LIST, 'ruangan');
      } catch (e) {
        callbacks.onError?.(e as Error);
      }
    }
  );

  const unsubBarang = onSnapshot(
    barangQuery,
    (snap) => {
      const list: Barang[] = snap.docs.map((d) => {
        const data = d.data();
        const item: Barang = {
          id: d.id,
          kodeBarang: data.kodeBarang ?? '1.3.2.05.02.01.001',
          nup: data.nup ?? '0001',
          namaBarang: data.namaBarang ?? 'Barang Inventaris',
          merkTipe: data.merkTipe ?? '',
          nomorSeri: data.nomorSeri ?? '',
          ukuran: data.ukuran ?? '',
          bahan: data.bahan ?? 'BESI',
          kategori: data.kategori ?? 'Alat Ukur & Laboratorium',
          tahunPerolehan: Number(data.tahunPerolehan) || 2024,
          sumberDana: data.sumberDana ?? 'BLUD',
          jumlah: Number(data.jumlah) || 1,
          satuan: data.satuan ?? 'UNIT',
          kondisi: data.kondisi ?? 'Baik',
          ruanganId: data.ruanganId ?? '',
          ruanganNama: data.ruanganNama ?? '',
          keterangan: data.keterangan ?? '',
          ownerId: data.ownerId,
          createdAt: timestampToIso(data.createdAt),
          updatedAt: timestampToIso(data.updatedAt),
        };

        // Migrate legacy v1 Barang (which had hargaPerolehan or lacked ukuran/bahan)
        const isLegacyV1 =
          'hargaPerolehan' in data ||
          typeof data.ukuran !== 'string' ||
          typeof data.bahan !== 'string';
        if (isLegacyV1 && !migratedDocIds.has(`barang/${d.id}`)) {
          migratedDocIds.add(`barang/${d.id}`);
          (async () => {
            try {
              await deleteDoc(doc(db, 'barang', d.id));
              await setDoc(doc(db, 'barang', d.id), {
                ...buildValidBarangPayload(uid, item),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } catch {
              // Ignore background migration errors if parent room doesn't exist yet
            }
          })();
        }

        return item;
      });
      callbacks.onBarang(list);
    },
    (error) => {
      callbacks.onConnectionLost?.(classifyUserDbError(error));
      try {
        handleFirestoreError(error, OperationType.LIST, 'barang');
      } catch (e) {
        callbacks.onError?.(e as Error);
      }
    }
  );

  const unsubMutasi = onSnapshot(
    mutasiQuery,
    (snap) => {
      const list: Mutasi[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nomorBeritaAcara: data.nomorBeritaAcara,
          tanggalMutasi: data.tanggalMutasi,
          jenisMutasi: data.jenisMutasi,
          barangId: data.barangId,
          kodeBarang: data.kodeBarang,
          namaBarang: data.namaBarang,
          ruanganAsalId: data.ruanganAsalId,
          ruanganAsalNama: data.ruanganAsalNama,
          ruanganTujuanId: data.ruanganTujuanId,
          ruanganTujuanNama: data.ruanganTujuanNama,
          kondisiAwal: data.kondisiAwal,
          kondisiAkhir: data.kondisiAkhir,
          petugasInput: data.petugasInput,
          alasanMutasi: data.alasanMutasi,
          ownerId: data.ownerId,
          createdAt: timestampToIso(data.createdAt),
        };
      });
      callbacks.onMutasi(list);
    },
    (error) => {
      callbacks.onConnectionLost?.(classifyUserDbError(error));
      try {
        handleFirestoreError(error, OperationType.LIST, 'mutasi');
      } catch (e) {
        callbacks.onError?.(e as Error);
      }
    }
  );

  return () => {
    unsubRuangan();
    unsubBarang();
    unsubMutasi();
  };
}

export async function createRuanganFirestore(uid: string, ruangan: Ruangan) {
  const rId = sanitizeId(ruangan.id);
  const path = `ruangan/${rId}`;
  try {
    await setDoc(doc(db, 'ruangan', rId), {
      ...buildValidRuanganPayload(uid, ruangan),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRuanganFirestore(uid: string, ruangan: Ruangan) {
  const rId = sanitizeId(ruangan.id);
  const path = `ruangan/${rId}`;
  const payload = buildValidRuanganPayload(uid, ruangan);
  try {
    await updateDoc(doc(db, 'ruangan', rId), {
      kodeRuangan: payload.kodeRuangan,
      namaRuangan: payload.namaRuangan,
      subRuangan: payload.subRuangan,
      gedung: payload.gedung,
      lantai: payload.lantai,
      penanggungJawab: payload.penanggungJawab,
      nipPenanggungJawab: payload.nipPenanggungJawab,
      unitKerja: payload.unitKerja,
      keterangan: payload.keterangan,
      updatedAt: serverTimestamp(),
    });
  } catch {
    try {
      await deleteDoc(doc(db, 'ruangan', rId)).catch(() => {});
      await setDoc(doc(db, 'ruangan', rId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (fallbackErr) {
      handleFirestoreError(fallbackErr, OperationType.UPDATE, path);
    }
  }
}

export async function deleteRuanganFirestore(id: string) {
  const path = `ruangan/${id}`;
  try {
    await deleteDoc(doc(db, 'ruangan', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createBarangFirestore(
  uid: string,
  barang: Barang,
  ruangan?: Ruangan
) {
  const bId = sanitizeId(barang.id);
  const path = `barang/${bId}`;
  try {
    if (ruangan && ruangan.ownerId !== uid) {
      await createRuanganFirestore(uid, ruangan);
    }
    await setDoc(doc(db, 'barang', bId), {
      ...buildValidBarangPayload(uid, barang),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBarangFirestore(
  uid: string,
  barang: Barang,
  ruangan?: Ruangan
) {
  const bId = sanitizeId(barang.id);
  const path = `barang/${bId}`;
  const payload = buildValidBarangPayload(uid, barang);
  try {
    if (ruangan && ruangan.ownerId !== uid) {
      await createRuanganFirestore(uid, ruangan);
    }
    await updateDoc(doc(db, 'barang', bId), {
      kodeBarang: payload.kodeBarang,
      nup: payload.nup,
      namaBarang: payload.namaBarang,
      merkTipe: payload.merkTipe,
      nomorSeri: payload.nomorSeri,
      ukuran: payload.ukuran,
      bahan: payload.bahan,
      kategori: payload.kategori,
      tahunPerolehan: payload.tahunPerolehan,
      sumberDana: payload.sumberDana,
      jumlah: payload.jumlah,
      satuan: payload.satuan,
      kondisi: payload.kondisi,
      ruanganId: payload.ruanganId,
      ruanganNama: payload.ruanganNama,
      keterangan: payload.keterangan,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Fallback for legacy v1 documents (that had hargaPerolehan) or unseeded local docs
    try {
      await deleteDoc(doc(db, 'barang', bId)).catch(() => {});
      await setDoc(doc(db, 'barang', bId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (fallbackErr) {
      handleFirestoreError(fallbackErr, OperationType.UPDATE, path);
    }
  }
}

export async function deleteBarangFirestore(id: string) {
  const path = `barang/${id}`;
  try {
    await deleteDoc(doc(db, 'barang', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordMutasiFirestore(
  uid: string,
  mutasi: Mutasi,
  barang?: Barang,
  ruanganTujuan?: Ruangan,
  ruanganAsal?: Ruangan
) {
  const mId = sanitizeId(mutasi.id);
  const bId = sanitizeId(mutasi.barangId);
  const rTujuanId = sanitizeId(mutasi.ruanganTujuanId);
  const rAsalId = sanitizeId(mutasi.ruanganAsalId || rTujuanId);
  const path = `mutasi/${mId}`;

  try {
    // 1. Ensure destination and origin rooms exist in Firestore for this user
    if (ruanganTujuan && ruanganTujuan.ownerId !== uid) {
      await createRuanganFirestore(uid, { ...ruanganTujuan, id: rTujuanId });
    }
    if (
      ruanganAsal &&
      ruanganAsal.ownerId !== uid &&
      ruanganAsal.id !== ruanganTujuan?.id
    ) {
      await createRuanganFirestore(uid, { ...ruanganAsal, id: rAsalId });
    }

    // 2. Update the Barang document first (or migrate/recreate if it was a legacy v1 doc or local doc)
    const updatedBarangObj: Barang = barang
      ? {
          ...barang,
          id: bId,
          ruanganId: rTujuanId,
          ruanganNama: mutasi.ruanganTujuanNama.trim().slice(0, 120),
          kondisi: mutasi.kondisiAkhir,
          keterangan: mutasi.alasanMutasi.trim().slice(0, 300),
          ownerId: uid,
        }
      : {
          id: bId,
          kodeBarang: mutasi.kodeBarang.trim().slice(0, 50),
          nup: '0001',
          namaBarang: mutasi.namaBarang.trim().slice(0, 150),
          merkTipe: '',
          nomorSeri: '',
          ukuran: '',
          bahan: 'BESI',
          kategori: 'Alat Ukur & Laboratorium',
          tahunPerolehan: 2024,
          sumberDana: 'BLUD',
          jumlah: 1,
          satuan: 'UNIT',
          kondisi: mutasi.kondisiAkhir,
          ruanganId: rTujuanId,
          ruanganNama: mutasi.ruanganTujuanNama.trim().slice(0, 120),
          keterangan: mutasi.alasanMutasi.trim().slice(0, 300),
          ownerId: uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    if (barang && barang.ownerId !== uid) {
      await deleteDoc(doc(db, 'barang', bId)).catch(() => {});
      await setDoc(doc(db, 'barang', bId), {
        ...buildValidBarangPayload(uid, updatedBarangObj),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      try {
        await updateDoc(doc(db, 'barang', bId), {
          ruanganId: rTujuanId,
          ruanganNama: mutasi.ruanganTujuanNama.trim().slice(0, 120),
          kondisi: mutasi.kondisiAkhir,
          keterangan: mutasi.alasanMutasi.trim().slice(0, 300),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Legacy v1 document with hargaPerolehan or missing ukuran/bahan: delete and recreate as clean v2
        await deleteDoc(doc(db, 'barang', bId)).catch(() => {});
        await setDoc(doc(db, 'barang', bId), {
          ...buildValidBarangPayload(uid, updatedBarangObj),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // 3. Create the Mutasi document (now that barang & ruanganTujuan are guaranteed in Firestore under uid)
    await setDoc(doc(db, 'mutasi', mId), {
      nomorBeritaAcara: mutasi.nomorBeritaAcara.trim().slice(0, 80),
      tanggalMutasi: mutasi.tanggalMutasi.trim().slice(0, 20),
      jenisMutasi: mutasi.jenisMutasi,
      barangId: bId,
      kodeBarang: mutasi.kodeBarang.trim().slice(0, 50),
      namaBarang: mutasi.namaBarang.trim().slice(0, 150),
      ruanganAsalId: rAsalId,
      ruanganAsalNama: (
        mutasi.ruanganAsalNama || mutasi.ruanganTujuanNama
      )
        .trim()
        .slice(0, 120),
      ruanganTujuanId: rTujuanId,
      ruanganTujuanNama: mutasi.ruanganTujuanNama.trim().slice(0, 120),
      kondisiAwal: mutasi.kondisiAwal,
      kondisiAkhir: mutasi.kondisiAkhir,
      petugasInput: mutasi.petugasInput.trim().slice(0, 100),
      alasanMutasi: mutasi.alasanMutasi.trim().slice(0, 300),
      ownerId: uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedInitialDataToFirestore(uid: string) {
  try {
    const suffix = uid.slice(0, 6);

    // 1. Seed Ruangan one by one (cleanly replacing any legacy v1 docs)
    for (const r of INITIAL_RUANGAN_LIST) {
      const rId = sanitizeId(`${r.id}-${suffix}`);
      await deleteDoc(doc(db, 'ruangan', rId)).catch(() => {});
      await setDoc(doc(db, 'ruangan', rId), {
        ...buildValidRuanganPayload(uid, { ...r, id: rId }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 2. Seed all 11 Barang one by one (avoids Firestore's 20-lookup-per-batch limit)
    for (const b of INITIAL_BARANG_LIST) {
      const bId = sanitizeId(`${b.id}-${suffix}`);
      const rId = sanitizeId(`${b.ruanganId}-${suffix}`);
      await deleteDoc(doc(db, 'barang', bId)).catch(() => {});
      await setDoc(doc(db, 'barang', bId), {
        ...buildValidBarangPayload(uid, {
          ...b,
          id: bId,
          ruanganId: rId,
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // 3. Seed initial Mutasi
    for (const m of INITIAL_MUTASI_LIST) {
      const mId = sanitizeId(`${m.id}-${suffix}`);
      const bId = sanitizeId(`${m.barangId}-${suffix}`);
      const rAsalId = sanitizeId(`${m.ruanganAsalId}-${suffix}`);
      const rTujuanId = sanitizeId(`${m.ruanganTujuanId}-${suffix}`);
      await deleteDoc(doc(db, 'mutasi', mId)).catch(() => {});
      await setDoc(doc(db, 'mutasi', mId), {
        nomorBeritaAcara: m.nomorBeritaAcara.trim().slice(0, 80),
        tanggalMutasi: m.tanggalMutasi.trim().slice(0, 20),
        jenisMutasi: m.jenisMutasi,
        barangId: bId,
        kodeBarang: m.kodeBarang.trim().slice(0, 50),
        namaBarang: m.namaBarang.trim().slice(0, 150),
        ruanganAsalId: rAsalId,
        ruanganAsalNama: m.ruanganAsalNama.trim().slice(0, 120),
        ruanganTujuanId: rTujuanId,
        ruanganTujuanNama: m.ruanganTujuanNama.trim().slice(0, 120),
        kondisiAwal: m.kondisiAwal,
        kondisiAkhir: m.kondisiAkhir,
        petugasInput: m.petugasInput.trim().slice(0, 100),
        alasanMutasi: m.alasanMutasi.trim().slice(0, 300),
        ownerId: uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed');
  }
}

async function deleteCollectionForUser(
  uid: string,
  collectionName: 'mutasi' | 'barang' | 'ruangan'
): Promise<number> {
  try {
    const q = query(
      collection(db, collectionName),
      where('ownerId', '==', uid)
    );
    const snap = await getDocsFromServer(q);
    if (snap.empty) {
      return 0;
    }

    const chunks = chunkForFirestoreBatch(
      snap.docs,
      FIRESTORE_SAFE_BATCH_LIMIT
    );
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const docSnap of chunk) {
        batch.delete(docSnap.ref);
        migratedDocIds.delete(`${collectionName}/${docSnap.id}`);
      }
      await batch.commit();
    }

    return snap.docs.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, collectionName);
  }
}

/**
 * Permanently deletes all ruangan, barang, and mutasi documents belonging to uid
 * in dependency-safe order (mutasi -> barang -> ruangan) using chunked Firestore WriteBatches.
 */
export async function resetUserFirestoreData(
  uid: string
): Promise<ResetDataSummary> {
  const deletedMutasi = await deleteCollectionForUser(uid, 'mutasi');
  const deletedBarang = await deleteCollectionForUser(uid, 'barang');
  const deletedRuangan = await deleteCollectionForUser(uid, 'ruangan');

  return {
    deletedRuangan,
    deletedBarang,
    deletedMutasi,
    totalDeleted: deletedRuangan + deletedBarang + deletedMutasi,
  };
}

