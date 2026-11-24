import { MasterReferensi, MasterReferensiJenis } from '../types/kir';
import { sanitizeId } from './kirLogic';

export interface MasterReferensiTabMeta {
  jenis: MasterReferensiJenis;
  label: string;
  shortLabel: string;
  description: string;
  namaLabel: string;
  namaPlaceholder: string;
  hasKode: boolean;
  kodeLabel?: string;
  kodePlaceholder?: string;
}

export const MASTER_REFERENSI_TABS: MasterReferensiTabMeta[] = [
  {
    jenis: 'satuan',
    label: 'Master Satuan',
    shortLabel: 'Satuan',
    description: 'Daftar satuan jumlah barang yang digunakan pada kolom 9 KIR (UNIT, SET, BUAH, dll.).',
    namaLabel: 'Nama Satuan',
    namaPlaceholder: 'Contoh: UNIT, SET, BUAH, PAKET',
    hasKode: false,
  },
  {
    jenis: 'bahan',
    label: 'Master Bahan',
    shortLabel: 'Bahan',
    description: 'Daftar bahan pembuatan barang yang digunakan pada kolom 6 KIR (BESI, KAYU, PLASTIK, dll.).',
    namaLabel: 'Nama Bahan',
    namaPlaceholder: 'Contoh: BESI, STAINLESS STEEL, KAYU, PLASTIK',
    hasKode: false,
  },
  {
    jenis: 'ukuran',
    label: 'Master Ukuran',
    shortLabel: 'Ukuran',
    description: 'Daftar ukuran atau kapasitas barang pada kolom 5 KIR (2 PK, 120x60 cm, 14 INCH, dll.).',
    namaLabel: 'Ukuran / Kapasitas',
    namaPlaceholder: 'Contoh: 2 PK, 120 x 60 cm, 14 INCH, SEDANG',
    hasKode: false,
  },
  {
    jenis: 'merk',
    label: 'Master Merk / Model',
    shortLabel: 'Merk / Model',
    description: 'Daftar merk atau pabrikan agar penulisan kolom 3 KIR seragam dan tidak terpecah akibat salah ketik.',
    namaLabel: 'Nama Merk / Model',
    namaPlaceholder: 'Contoh: PANASONIC, DAIKIN, DELL, OLYMPUS, LEICA',
    hasKode: false,
  },
  {
    jenis: 'katalog',
    label: 'Master Katalog Barang',
    shortLabel: 'Katalog Barang',
    description: 'Padanan baku No. Kode Barang (Kolom 8) dan Jenis / Nama Barang (Kolom 2) agar pengisian lebih cepat dan seragam.',
    namaLabel: 'Jenis / Nama Barang',
    namaPlaceholder: 'Contoh: A.C SPLIT, COMPUTER / PC, TEMPAT TIDUR PASIEN',
    hasKode: true,
    kodeLabel: 'No. Kode Barang',
    kodePlaceholder: 'Contoh: 1.3.2.05.02.04.004',
  },
];

export const CUSTOM_MANUAL_OPTION_VALUE = '__CUSTOM_MANUAL__';

export interface MasterReferensiSeedItem {
  jenis: MasterReferensiJenis;
  nama: string;
  kode?: string;
  keterangan?: string;
}

export const DEFAULT_MASTER_REFERENSI_SEEDS: MasterReferensiSeedItem[] = [
  // Satuan
  { jenis: 'satuan', nama: 'UNIT', keterangan: 'Satuan peralatan elektronik, mesin, atau alat medis' },
  { jenis: 'satuan', nama: 'BUAH', keterangan: 'Satuan meubelair atau perlengkapan satuan' },
  { jenis: 'satuan', nama: 'SET', keterangan: 'Satuan perangkat satu paket lengkap' },
  { jenis: 'satuan', nama: 'PAKET', keterangan: 'Satuan pengadaan dalam satu paket' },
  { jenis: 'satuan', nama: 'PASANG', keterangan: 'Satuan barang berpasangan' },
  { jenis: 'satuan', nama: 'LEMBAR', keterangan: 'Satuan barang lembaran' },

  // Bahan
  { jenis: 'bahan', nama: 'BESI', keterangan: 'Logam besi / baja standar' },
  { jenis: 'bahan', nama: 'STAINLESS STEEL', keterangan: 'Baja tahan karat (alat medis & dapur)' },
  { jenis: 'bahan', nama: 'KAYU', keterangan: 'Kayu jati / multiplek / HPL' },
  { jenis: 'bahan', nama: 'PLASTIK', keterangan: 'Plastik ABS / PVC / fiber plastik' },
  { jenis: 'bahan', nama: 'ALUMUNIUM', keterangan: 'Logam ringan alumunium' },
  { jenis: 'bahan', nama: 'KACA', keterangan: 'Kaca / gelas laboratorium' },
  { jenis: 'bahan', nama: 'CAMPURAN', keterangan: 'Kombinasi logam, plastik, dan komponen elektronik' },

  // Ukuran
  { jenis: 'ukuran', nama: '1/2 PK', keterangan: 'Kapasitas AC ruangan kecil' },
  { jenis: 'ukuran', nama: '1 PK', keterangan: 'Kapasitas AC standar' },
  { jenis: 'ukuran', nama: '1.5 PK', keterangan: 'Kapasitas AC ruangan sedang' },
  { jenis: 'ukuran', nama: '2 PK', keterangan: 'Kapasitas AC ruangan besar / instalasi' },
  { jenis: 'ukuran', nama: '120 x 60 cm', keterangan: 'Meja kerja 1/2 biro standar' },
  { jenis: 'ukuran', nama: '160 x 80 cm', keterangan: 'Meja kerja 1 biro' },
  { jenis: 'ukuran', nama: '210 x 95 cm', keterangan: 'Tempat tidur pasien standar RS' },
  { jenis: 'ukuran', nama: '14 INCH', keterangan: 'Layar laptop / monitor compact' },
  { jenis: 'ukuran', nama: '24 INCH', keterangan: 'Monitor desktop standar' },
  { jenis: 'ukuran', nama: 'KECIL', keterangan: 'Ukuran umum kategori kecil' },
  { jenis: 'ukuran', nama: 'SEDANG', keterangan: 'Ukuran umum kategori sedang' },
  { jenis: 'ukuran', nama: 'BESAR', keterangan: 'Ukuran umum kategori besar' },

  // Merk / Model
  { jenis: 'merk', nama: 'PANASONIC', keterangan: 'Elektronik & tata udara' },
  { jenis: 'merk', nama: 'DAIKIN', keterangan: 'Pendingin ruangan / AC' },
  { jenis: 'merk', nama: 'DELL', keterangan: 'Komputer & server IT' },
  { jenis: 'merk', nama: 'EPSON', keterangan: 'Printer & proyektor' },
  { jenis: 'merk', nama: 'POLYTRON', keterangan: 'Lemari es & elektronik' },
  { jenis: 'merk', nama: 'OLYMPUS', keterangan: 'Mikroskop & alat laboratorium' },
  { jenis: 'merk', nama: 'LEICA', keterangan: 'Peralatan patologi & laboratorium' },
  { jenis: 'merk', nama: 'HETTICH', keterangan: 'Centrifuge laboratorium' },
  { jenis: 'merk', nama: 'CHITOSE', keterangan: 'Meubelair kursi & meja kantor' },
  { jenis: 'merk', nama: 'IMPORTA', keterangan: 'Lemari arsip & lemari besi' },
  { jenis: 'merk', nama: 'MINDRAY', keterangan: 'Alat kesehatan & monitor pasien' },

  // Katalog Jenis & Kode Barang
  { jenis: 'katalog', kode: '1.3.2.05.02.01.001', nama: 'COMPUTER', keterangan: 'Komputer desktop / PC operasional' },
  { jenis: 'katalog', kode: '1.3.2.05.02.01.005', nama: 'PRINTER', keterangan: 'Perangkat cetak dokumen' },
  { jenis: 'katalog', kode: '1.3.2.05.02.04.004', nama: 'A.C SPLIT', keterangan: 'Pendingin ruangan unit split' },
  { jenis: 'katalog', kode: '1.3.2.05.02.04.001', nama: 'LEMARI ES', keterangan: 'Kulkas / lemari pendingin' },
  { jenis: 'katalog', kode: '1.3.2.05.01.04.001', nama: 'LEMARI ARSIP / REAGEN', keterangan: 'Lemari penyimpanan berkas atau reagen' },
  { jenis: 'katalog', kode: '1.3.2.05.01.05.001', nama: 'MEJA KERJA', keterangan: 'Meja kantor / meja administrasi' },
  { jenis: 'katalog', kode: '1.3.2.05.01.05.002', nama: 'KURSI KERJA', keterangan: 'Kursi staf / kursi tunggu' },
  { jenis: 'katalog', kode: '1.3.2.08.01.11.001', nama: 'CENTRIFUGE', keterangan: 'Alat sentrifugasi laboratorium' },
  { jenis: 'katalog', kode: '1.3.2.07.01.01.001', nama: 'TEMPAT TIDUR PASIEN', keterangan: 'Bed rawat inap pasien' },
  { jenis: 'katalog', kode: '1.3.2.06.02.01.044', nama: 'TAB / HANDPHONE', keterangan: 'Perangkat komunikasi mobile dinas' },
];

export function buildDefaultMasterReferensiList(ownerId = 'default'): MasterReferensi[] {
  const nowIso = '2026-01-01T00:00:00.000Z';
  return DEFAULT_MASTER_REFERENSI_SEEDS.map((seed, idx) => ({
    id: sanitizeId(`ref-${seed.jenis}-${idx + 1}`),
    jenis: seed.jenis,
    nama: seed.nama,
    kode: seed.kode || '',
    keterangan: seed.keterangan || '',
    ownerId,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

/**
 * Returns sorted master options for a specific jenis.
 * If the user has saved items for this jenis in their master list, uses those exclusively
 * (respecting their additions/deletions); otherwise gracefully falls back to RSUD starter defaults.
 */
export function getEffectiveMasterOptions(
  masterList: MasterReferensi[],
  jenis: MasterReferensiJenis
): MasterReferensi[] {
  const userItems = masterList.filter((item) => item.jenis === jenis);
  const source =
    userItems.length > 0
      ? userItems
      : buildDefaultMasterReferensiList().filter((item) => item.jenis === jenis);

  return [...source].sort((a, b) =>
    a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' })
  );
}

/**
 * Computes which seed items do not yet exist in the user's current masterList
 * (case-insensitive match by jenis + nama, or jenis + kode for katalog).
 */
export function getMissingDefaultSeeds(
  existingList: MasterReferensi[],
  ownerId: string,
  targetJenis?: MasterReferensiJenis
): MasterReferensi[] {
  const seeds = targetJenis
    ? DEFAULT_MASTER_REFERENSI_SEEDS.filter((s) => s.jenis === targetJenis)
    : DEFAULT_MASTER_REFERENSI_SEEDS;

  const existingKeys = new Set(
    existingList.map((item) => `${item.jenis}::${item.nama.trim().toLowerCase()}`)
  );

  const nowIso = new Date().toISOString();
  const stamp = Date.now().toString().slice(-5);

  return seeds
    .filter(
      (seed) =>
        !existingKeys.has(`${seed.jenis}::${seed.nama.trim().toLowerCase()}`)
    )
    .map((seed, idx) => ({
      id: sanitizeId(`ref-${seed.jenis}-${stamp}-${idx + 1}`),
      jenis: seed.jenis,
      nama: seed.nama.trim(),
      kode: (seed.kode || '').trim(),
      keterangan: (seed.keterangan || '').trim(),
      ownerId,
      createdAt: nowIso,
      updatedAt: nowIso,
    }));
}

export function validateMasterReferensiInput(
  input: {
    jenis: MasterReferensiJenis;
    nama: string;
    kode?: string;
    keterangan?: string;
  },
  existingList: MasterReferensi[],
  editingId?: string
): { valid: boolean; error?: string } {
  const nama = (input.nama ?? '').trim();
  const kode = (input.kode ?? '').trim();
  const keterangan = (input.keterangan ?? '').trim();

  if (nama.length < 1 || nama.length > 120) {
    return { valid: false, error: 'Nama master harus diisi (1–120 karakter).' };
  }
  if (input.jenis === 'katalog' && (kode.length < 1 || kode.length > 50)) {
    return {
      valid: false,
      error: 'No. Kode Barang wajib diisi untuk Master Katalog (1–50 karakter).',
    };
  }
  if (kode.length > 50) {
    return { valid: false, error: 'Kode maksimal 50 karakter.' };
  }
  if (keterangan.length > 200) {
    return { valid: false, error: 'Keterangan maksimal 200 karakter.' };
  }

  const normalizedNama = nama.toLowerCase();
  const duplicate = existingList.find(
    (item) =>
      item.jenis === input.jenis &&
      item.id !== editingId &&
      item.nama.trim().toLowerCase() === normalizedNama
  );
  if (duplicate) {
    return {
      valid: false,
      error: `"${nama}" sudah terdaftar pada master ini.`,
    };
  }

  return { valid: true };
}

/**
 * Matches a form field string against a master list (case-insensitive).
 * Returns the canonical option name if matched, or null if it is a custom/manual value.
 */
export function findMatchingMasterValue(
  currentValue: string,
  options: MasterReferensi[]
): string | null {
  const trimmed = currentValue.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const found = options.find((opt) => opt.nama.trim().toLowerCase() === lower);
  return found ? found.nama : null;
}
