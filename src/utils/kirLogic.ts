import {
  Barang,
  InstansiSetting,
  KategoriBarang,
  KondisiBarang,
  Mutasi,
  Ruangan,
} from '../types/kir';

export const KATEGORI_LIST: KategoriBarang[] = [
  'Alat Ukur & Laboratorium',
  'Elektronik & IT',
  'Meubelair & Furniture',
  'Pendingin & Tata Udara',
  'Perlengkapan Kantor',
  'Kendaraan & Operasional',
];

export const KONDISI_LIST: KondisiBarang[] = [
  'Baik',
  'Kurang Baik',
  'Rusak Berat',
];

export const KODE_RUANGAN_REGEX = /^[a-zA-Z0-9_\-./ ]+$/;
export const DOC_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-]/g, '-');
  return cleaned.slice(0, 120) || `id-${Date.now()}`;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface RuanganGroup {
  parentName: string;
  gedung: string;
  lantai: string;
  unitKerja: string;
  penanggungJawab: string;
  nipPenanggungJawab: string;
  subRuanganList: Ruangan[];
}

export function groupRuanganByParent(ruanganList: Ruangan[]): RuanganGroup[] {
  const map = new Map<string, RuanganGroup>();
  for (const r of ruanganList) {
    const parentName = r.namaRuangan.trim() || 'RUANGAN UMUM';
    const key = parentName.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.subRuanganList.push(r);
    } else {
      map.set(key, {
        parentName,
        gedung: r.gedung,
        lantai: r.lantai,
        unitKerja: r.unitKerja,
        penanggungJawab: r.penanggungJawab,
        nipPenanggungJawab: r.nipPenanggungJawab,
        subRuanganList: [r],
      });
    }
  }
  return Array.from(map.values());
}

export function getUniqueParentRuanganNames(ruanganList: Ruangan[]): string[] {
  return groupRuanganByParent(ruanganList).map((g) => g.parentName);
}

export function getSubRuanganByParent(
  ruanganList: Ruangan[],
  parentName: string
): Ruangan[] {
  const normalized = parentName.trim().toLowerCase();
  if (!normalized || normalized === 'all') return ruanganList;
  return ruanganList.filter(
    (r) => r.namaRuangan.trim().toLowerCase() === normalized
  );
}

export function formatRuanganFullLabel(
  ruangan?: Pick<Ruangan, 'namaRuangan' | 'subRuangan'> | null,
  fallbackName?: string
): string {
  if (!ruangan) return fallbackName || '-';
  const parent = ruangan.namaRuangan.trim();
  const sub = (ruangan.subRuangan ?? '').trim();
  if (sub) {
    return `${parent} — ${sub}`;
  }
  return parent || fallbackName || '-';
}

export function resolveBarangRoom(
  item: Pick<Barang, 'ruanganId' | 'ruanganNama'>,
  ruanganList: Ruangan[]
): {
  parentName: string;
  subName: string;
  fullLabel: string;
  ruangan?: Ruangan;
} {
  const ruangan = ruanganList.find((r) => r.id === item.ruanganId);
  if (ruangan) {
    const parentName = ruangan.namaRuangan.trim();
    const subName = (ruangan.subRuangan ?? '').trim();
    return {
      parentName,
      subName,
      fullLabel: subName ? `${parentName} — ${subName}` : parentName,
      ruangan,
    };
  }
  return {
    parentName: item.ruanganNama || '-',
    subName: '',
    fullLabel: item.ruanganNama || '-',
  };
}

const GENERIC_ROOM_WORDS = new Set([
  'RUANG',
  'RUANGAN',
  'R',
  'INST',
  'INSTALASI',
  'BAGIAN',
  'SUBBAGIAN',
  'BIDANG',
  'UNIT',
  'GEDUNG',
]);

export function deriveRuanganCodePrefix(
  parentName: string,
  existingRuanganList: Ruangan[]
): string {
  const normalizedParent = parentName.trim().toLowerCase();
  if (normalizedParent) {
    const existingSameParent = existingRuanganList.find(
      (r) => r.namaRuangan.trim().toLowerCase() === normalizedParent
    );
    if (existingSameParent) {
      const match = existingSameParent.kodeRuangan
        .trim()
        .match(/^([A-Za-z0-9\-]+?)-(\d+)$/);
      if (match) {
        return match[1].toUpperCase();
      }
    }
  }

  const tokens = parentName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const meaningful =
    tokens.find((t) => !GENERIC_ROOM_WORDS.has(t)) || tokens[0] || 'RNG';
  const slug = meaningful.slice(0, 6);
  return `R-${slug}`;
}

export function generateAutoKodeRuangan(
  parentName: string,
  existingRuanganList: Ruangan[],
  extraReservedCodes: string[] = []
): string {
  const prefix = deriveRuanganCodePrefix(parentName, existingRuanganList);
  const allExistingCodes = new Set<string>([
    ...existingRuanganList.map((r) => r.kodeRuangan.trim().toUpperCase()),
    ...extraReservedCodes.map((c) => c.trim().toUpperCase()),
  ]);

  let maxSeq = 0;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const seqRegex = new RegExp(`^${escapedPrefix}-(\\d+)$`, 'i');

  for (const code of allExistingCodes) {
    const match = code.match(seqRegex);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxSeq) {
        maxSeq = n;
      }
    }
  }

  let seq = maxSeq + 1;
  let candidate = `${prefix}-${String(seq).padStart(2, '0')}`;
  while (allExistingCodes.has(candidate.toUpperCase())) {
    seq += 1;
    candidate = `${prefix}-${String(seq).padStart(2, '0')}`;
  }

  return candidate;
}

export function generateAutoKodeRuanganBatch(
  parentName: string,
  count: number,
  existingRuanganList: Ruangan[]
): string[] {
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const nextCode = generateAutoKodeRuangan(
      parentName,
      existingRuanganList,
      results
    );
    results.push(nextCode);
  }
  return results;
}

export function validateRuanganInput(
  input: Partial<Ruangan>
): ValidationResult {
  const kode = (input.kodeRuangan ?? '').trim();
  const nama = (input.namaRuangan ?? '').trim();
  const sub = (input.subRuangan ?? '').trim();
  const gedung = (input.gedung ?? '').trim();
  const lantai = (input.lantai ?? '').trim();
  const pj = (input.penanggungJawab ?? '').trim();
  const nip = (input.nipPenanggungJawab ?? '').trim();
  const unit = (input.unitKerja ?? '').trim();
  const ket = (input.keterangan ?? '').trim();

  if (kode.length < 2 || kode.length > 32) {
    return { valid: false, error: 'Kode ruangan harus 2–32 karakter.' };
  }
  if (!KODE_RUANGAN_REGEX.test(kode)) {
    return {
      valid: false,
      error: 'Kode ruangan hanya boleh huruf, angka, spasi, titik, atau strip.',
    };
  }
  if (nama.length < 2 || nama.length > 120) {
    return { valid: false, error: 'Nama ruangan induk harus 2–120 karakter.' };
  }
  if (sub.length > 120) {
    return { valid: false, error: 'Nama sub-ruangan maksimal 120 karakter.' };
  }
  if (gedung.length < 1 || gedung.length > 80) {
    return { valid: false, error: 'Nama gedung wajib diisi (maks 80 karakter).' };
  }
  if (lantai.length < 1 || lantai.length > 20) {
    return { valid: false, error: 'Lantai wajib diisi (maks 20 karakter).' };
  }
  if (pj.length < 2 || pj.length > 100) {
    return {
      valid: false,
      error: 'Nama penanggung jawab ruangan harus 2–100 karakter.',
    };
  }
  if (nip.length < 1 || nip.length > 40) {
    return {
      valid: false,
      error: 'NIP / ID Penanggung Jawab wajib diisi (maks 40 karakter).',
    };
  }
  if (unit.length < 2 || unit.length > 100) {
    return { valid: false, error: 'Unit kerja harus 2–100 karakter.' };
  }
  if (ket.length > 300) {
    return { valid: false, error: 'Keterangan maksimal 300 karakter.' };
  }

  return { valid: true };
}

export function validateBarangInput(input: Partial<Barang>): ValidationResult {
  const kode = (input.kodeBarang ?? '').trim();
  const nup = (input.nup ?? '').trim();
  const nama = (input.namaBarang ?? '').trim();
  const merk = (input.merkTipe ?? '').trim();
  const sn = (input.nomorSeri ?? '').trim();
  const ukuran = (input.ukuran ?? '').trim();
  const bahan = (input.bahan ?? '').trim();
  const kategori = input.kategori;
  const tahun = Number(input.tahunPerolehan);
  const sumber = (input.sumberDana ?? '').trim();
  const jumlah = Number(input.jumlah);
  const satuan = (input.satuan ?? '').trim();
  const kondisi = input.kondisi;
  const ruanganId = (input.ruanganId ?? '').trim();
  const ket = (input.keterangan ?? '').trim();

  if (kode.length < 1 || kode.length > 50) {
    return { valid: false, error: 'No. Kode Barang harus 1–50 karakter.' };
  }
  if (nup.length < 1 || nup.length > 20) {
    return { valid: false, error: 'NUP / No. Urut harus 1–20 karakter.' };
  }
  if (nama.length < 2 || nama.length > 150) {
    return { valid: false, error: 'Jenis / Nama barang harus 2–150 karakter.' };
  }
  if (merk.length > 150) {
    return { valid: false, error: 'Merk / Model maksimal 150 karakter.' };
  }
  if (sn.length > 100) {
    return { valid: false, error: 'No. Seri Pabrik maksimal 100 karakter.' };
  }
  if (ukuran.length > 80) {
    return { valid: false, error: 'Ukuran maksimal 80 karakter.' };
  }
  if (bahan.length < 1 || bahan.length > 80) {
    return { valid: false, error: 'Bahan wajib diisi (maks 80 karakter).' };
  }
  if (!kategori || !KATEGORI_LIST.includes(kategori)) {
    return { valid: false, error: 'Kategori barang tidak valid.' };
  }
  if (!Number.isInteger(tahun) || tahun < 1970 || tahun > 2100) {
    return { valid: false, error: 'Tahun pembuatan/pembelian harus antara 1970–2100.' };
  }
  if (sumber.length < 2 || sumber.length > 60) {
    return { valid: false, error: 'Sumber dana harus 2–60 karakter.' };
  }
  if (!Number.isInteger(jumlah) || jumlah < 1 || jumlah > 100000) {
    return { valid: false, error: 'Jumlah barang harus bilangan bulat minimal 1.' };
  }
  if (satuan.length < 1 || satuan.length > 30) {
    return { valid: false, error: 'Satuan wajib diisi.' };
  }
  if (!kondisi || !KONDISI_LIST.includes(kondisi)) {
    return { valid: false, error: 'Keadaan barang tidak valid.' };
  }
  if (!ruanganId || !DOC_ID_REGEX.test(ruanganId)) {
    return { valid: false, error: 'Pilih ruangan & sub-ruangan penempatan yang valid.' };
  }
  if (ket.length > 300) {
    return { valid: false, error: 'Keterangan maksimal 300 karakter.' };
  }

  return { valid: true };
}

export function validateMutasiInput(input: Partial<Mutasi>): ValidationResult {
  const noBa = (input.nomorBeritaAcara ?? '').trim();
  const tanggal = (input.tanggalMutasi ?? '').trim();
  const barangId = (input.barangId ?? '').trim();
  const ruanganTujuanId = (input.ruanganTujuanId ?? '').trim();
  const petugas = (input.petugasInput ?? '').trim();
  const alasan = (input.alasanMutasi ?? '').trim();

  if (noBa.length < 3 || noBa.length > 80) {
    return { valid: false, error: 'Nomor Berita Acara harus 3–80 karakter.' };
  }
  if (tanggal.length < 8 || tanggal.length > 20) {
    return { valid: false, error: 'Tanggal mutasi wajib diisi.' };
  }
  if (!barangId || !DOC_ID_REGEX.test(barangId)) {
    return { valid: false, error: 'Barang yang dimutasi wajib dipilih.' };
  }
  if (!ruanganTujuanId || !DOC_ID_REGEX.test(ruanganTujuanId)) {
    return { valid: false, error: 'Ruangan / Sub-ruangan tujuan wajib dipilih.' };
  }
  if (petugas.length < 2 || petugas.length > 100) {
    return { valid: false, error: 'Nama petugas harus 2–100 karakter.' };
  }
  if (alasan.length < 2 || alasan.length > 300) {
    return { valid: false, error: 'Alasan mutasi harus 2–300 karakter.' };
  }

  return { valid: true };
}

export interface KirSummaryStats {
  totalJenisBarang: number;
  totalUnitBarang: number;
  totalParentRuangan: number;
  totalRuangan: number;
  totalMutasi: number;
  kondisiBaik: number;
  kondisiKurangBaik: number;
  kondisiRusakBerat: number;
  persenBaik: number;
}

export function calculateKirStats(
  barangList: Barang[],
  ruanganList: Ruangan[],
  mutasiList: Mutasi[]
): KirSummaryStats {
  let totalUnitBarang = 0;
  let kondisiBaik = 0;
  let kondisiKurangBaik = 0;
  let kondisiRusakBerat = 0;

  for (const item of barangList) {
    const qty = Number(item.jumlah) || 0;
    totalUnitBarang += qty;
    if (item.kondisi === 'Baik') {
      kondisiBaik += qty;
    } else if (item.kondisi === 'Kurang Baik') {
      kondisiKurangBaik += qty;
    } else if (item.kondisi === 'Rusak Berat') {
      kondisiRusakBerat += qty;
    }
  }

  const persenBaik =
    totalUnitBarang > 0 ? Math.round((kondisiBaik / totalUnitBarang) * 100) : 0;

  const totalParentRuangan = getUniqueParentRuanganNames(ruanganList).length;

  return {
    totalJenisBarang: barangList.length,
    totalUnitBarang,
    totalParentRuangan,
    totalRuangan: ruanganList.length,
    totalMutasi: mutasiList.length,
    kondisiBaik,
    kondisiKurangBaik,
    kondisiRusakBerat,
    persenBaik,
  };
}

export function filterBarangList(
  barangList: Barang[],
  options: {
    search?: string;
    parentRuanganName?: string;
    ruanganId?: string;
    kategori?: string;
    kondisi?: string;
    ruanganList?: Ruangan[];
  }
): Barang[] {
  const q = (options.search ?? '').trim().toLowerCase();
  const parentName = options.parentRuanganName ?? 'ALL';
  const ruanganId = options.ruanganId ?? 'ALL';
  const kategori = options.kategori ?? 'ALL';
  const kondisi = options.kondisi ?? 'ALL';
  const ruanganList = options.ruanganList ?? [];

  const allowedSubIds =
    parentName !== 'ALL' && ruanganList.length > 0
      ? new Set(
          getSubRuanganByParent(ruanganList, parentName).map((r) => r.id)
        )
      : null;

  return barangList.filter((item) => {
    if (ruanganId !== 'ALL' && item.ruanganId !== ruanganId) return false;
    if (ruanganId === 'ALL' && parentName !== 'ALL') {
      if (allowedSubIds) {
        if (!allowedSubIds.has(item.ruanganId)) return false;
      } else if (
        item.ruanganNama.trim().toLowerCase() !== parentName.trim().toLowerCase()
      ) {
        return false;
      }
    }
    if (kategori !== 'ALL' && item.kategori !== kategori) return false;
    if (kondisi !== 'ALL' && item.kondisi !== kondisi) return false;
    if (!q) return true;

    const resolved =
      ruanganList.length > 0
        ? resolveBarangRoom(item, ruanganList)
        : { parentName: item.ruanganNama, subName: '' };

    return (
      item.namaBarang.toLowerCase().includes(q) ||
      item.kodeBarang.toLowerCase().includes(q) ||
      item.nup.toLowerCase().includes(q) ||
      item.merkTipe.toLowerCase().includes(q) ||
      item.nomorSeri.toLowerCase().includes(q) ||
      item.ukuran.toLowerCase().includes(q) ||
      item.bahan.toLowerCase().includes(q) ||
      item.ruanganNama.toLowerCase().includes(q) ||
      resolved.parentName.toLowerCase().includes(q) ||
      resolved.subName.toLowerCase().includes(q)
    );
  });
}

export function applyMutasiToBarang(
  barangList: Barang[],
  mutasi: Pick<
    Mutasi,
    'barangId' | 'ruanganTujuanId' | 'ruanganTujuanNama' | 'kondisiAkhir' | 'alasanMutasi'
  >,
  timestampIso: string
): Barang[] {
  return barangList.map((item) => {
    if (item.id !== mutasi.barangId) return item;
    return {
      ...item,
      ruanganId: mutasi.ruanganTujuanId,
      ruanganNama: mutasi.ruanganTujuanNama,
      kondisi: mutasi.kondisiAkhir,
      keterangan: mutasi.alasanMutasi.slice(0, 300),
      updatedAt: timestampIso,
    };
  });
}

export function buildQrPayload(
  item: Barang,
  kodeLokasi: string,
  ruangan?: Ruangan
): string {
  return JSON.stringify({
    app: 'SIMKIR',
    loc: kodeLokasi,
    kode: item.kodeBarang,
    nup: item.nup,
    nama: item.namaBarang,
    merk: item.merkTipe,
    ukuran: item.ukuran,
    bahan: item.bahan,
    ruang: ruangan?.namaRuangan || item.ruanganNama,
    subRuang: ruangan?.subRuangan || '',
    thn: item.tahunPerolehan,
    kondisi: item.kondisi,
  });
}

export function getConditionCounts(item: Barang): {
  baik: number;
  kurangBaik: number;
  rusakBerat: number;
} {
  const qty = Number(item.jumlah) || 0;
  return {
    baik: item.kondisi === 'Baik' ? qty : 0,
    kurangBaik: item.kondisi === 'Kurang Baik' ? qty : 0,
    rusakBerat: item.kondisi === 'Rusak Berat' ? qty : 0,
  };
}

export interface ConditionBreakdown {
  baik: number;
  kurangBaik: number;
  rusakBerat: number;
}

export function incrementNupString(startNup: string, offset: number): string {
  const trimmed = startNup.trim();
  if (offset === 0) return trimmed;
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const [, prefix, digits] = match;
    const nextNum = Number(digits) + offset;
    return `${prefix}${String(nextNum).padStart(digits.length, '0')}`.slice(0, 20);
  }
  return `${trimmed}-${offset + 1}`.slice(0, 20);
}

export function buildBarangRecordsFromConditionBreakdown(
  base: Omit<Barang, 'id' | 'jumlah' | 'kondisi' | 'nup'>,
  startNup: string,
  breakdown: ConditionBreakdown,
  idSeed = Date.now().toString().slice(-5)
): Barang[] {
  const rawEntries: Array<{ kondisi: KondisiBarang; jumlah: number }> = [
    { kondisi: 'Baik', jumlah: Math.max(0, Math.floor(Number(breakdown.baik) || 0)) },
    {
      kondisi: 'Kurang Baik',
      jumlah: Math.max(0, Math.floor(Number(breakdown.kurangBaik) || 0)),
    },
    {
      kondisi: 'Rusak Berat',
      jumlah: Math.max(0, Math.floor(Number(breakdown.rusakBerat) || 0)),
    },
  ];
  const entries = rawEntries.filter((e) => e.jumlah > 0);

  return entries.map((entry, idx) => {
    const nup = incrementNupString(startNup, idx);
    return {
      ...base,
      id: sanitizeId(`brg-${nup}-${idSeed}-${idx + 1}`),
      nup,
      jumlah: entry.jumlah,
      kondisi: entry.kondisi,
    };
  });
}

export interface KirReportRow {
  rowKey: string;
  namaBarang: string;
  merkTipe: string;
  nomorSeri: string;
  ukuran: string;
  bahan: string;
  tahunPerolehan: number;
  kodeBarang: string;
  jumlah: number;
  satuan: string;
  baik: number;
  kurangBaik: number;
  rusakBerat: number;
  keterangan: string;
  locationLabel: string;
  itemCount: number;
}

export function consolidateKirReportRows(
  barangList: Barang[],
  options?: {
    ruangan?: Ruangan;
    ruanganList?: Ruangan[];
    consolidateSameItems?: boolean;
  }
): KirReportRow[] {
  const ruangan = options?.ruangan;
  const ruanganList = options?.ruanganList ?? [];
  const consolidate = options?.consolidateSameItems ?? true;

  if (!consolidate) {
    return barangList.map((item) => {
      const cond = getConditionCounts(item);
      const resolved = resolveBarangRoom(item, ruanganList);
      return {
        rowKey: item.id,
        namaBarang: item.namaBarang,
        merkTipe: item.merkTipe || '',
        nomorSeri: item.nomorSeri || '',
        ukuran: item.ukuran || '',
        bahan: item.bahan || '',
        tahunPerolehan: item.tahunPerolehan,
        kodeBarang: item.kodeBarang,
        jumlah: Number(item.jumlah) || 0,
        satuan: item.satuan,
        baik: cond.baik,
        kurangBaik: cond.kurangBaik,
        rusakBerat: cond.rusakBerat,
        keterangan: item.keterangan || '',
        locationLabel: !ruangan
          ? resolved.subName || resolved.parentName
          : '',
        itemCount: 1,
      };
    });
  }

  const map = new Map<string, KirReportRow>();
  const ketSetMap = new Map<string, Set<string>>();

  for (const item of barangList) {
    const cond = getConditionCounts(item);
    const resolved = resolveBarangRoom(item, ruanganList);
    const locationLabel = !ruangan
      ? resolved.subName || resolved.parentName
      : '';

    const key = [
      item.ruanganId.trim().toLowerCase(),
      item.kodeBarang.trim().toLowerCase(),
      item.namaBarang.trim().toLowerCase(),
      (item.merkTipe || '').trim().toLowerCase(),
      (item.nomorSeri || '').trim().toLowerCase(),
      (item.ukuran || '').trim().toLowerCase(),
      (item.bahan || '').trim().toLowerCase(),
      String(item.tahunPerolehan),
      item.satuan.trim().toLowerCase(),
    ].join('|');

    const cleanKet = (item.keterangan || '').trim();
    const existing = map.get(key);

    if (existing) {
      existing.jumlah += Number(item.jumlah) || 0;
      existing.baik += cond.baik;
      existing.kurangBaik += cond.kurangBaik;
      existing.rusakBerat += cond.rusakBerat;
      existing.itemCount += 1;
      if (cleanKet) {
        const kSet = ketSetMap.get(key)!;
        if (!kSet.has(cleanKet.toLowerCase())) {
          kSet.add(cleanKet.toLowerCase());
          existing.keterangan = existing.keterangan
            ? `${existing.keterangan}; ${cleanKet}`
            : cleanKet;
        }
      }
    } else {
      const kSet = new Set<string>();
      if (cleanKet) kSet.add(cleanKet.toLowerCase());
      ketSetMap.set(key, kSet);

      map.set(key, {
        rowKey: key,
        namaBarang: item.namaBarang,
        merkTipe: item.merkTipe || '',
        nomorSeri: item.nomorSeri || '',
        ukuran: item.ukuran || '',
        bahan: item.bahan || '',
        tahunPerolehan: item.tahunPerolehan,
        kodeBarang: item.kodeBarang,
        jumlah: Number(item.jumlah) || 0,
        satuan: item.satuan,
        baik: cond.baik,
        kurangBaik: cond.kurangBaik,
        rusakBerat: cond.rusakBerat,
        keterangan: cleanKet,
        locationLabel,
        itemCount: 1,
      });
    }
  }

  return Array.from(map.values());
}

export function generateKirCsv(
  barangList: Barang[],
  ruangan?: Ruangan,
  startNo = 1,
  ruanganList: Ruangan[] = [],
  consolidateSameItems = true
): string {
  const header = [
    'Urut',
    'Jenis barang/ Nama barang',
    'Merk/ Model',
    'No.Seri Pabrik',
    'Ukuran',
    'Bahan',
    'Tahun Pembuatan /Pembelian',
    'No. Kode barang',
    'Jumlah Barang',
    'Keadaan Baik',
    'Keadaan Kurang Baik',
    'Keadaan Rusak Berat',
    'Keterangan',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const consolidatedRows = consolidateKirReportRows(barangList, {
    ruangan,
    ruanganList,
    consolidateSameItems,
  });

  const rows = consolidatedRows.map((row, idx) => {
    const ket = row.locationLabel
      ? row.keterangan
        ? `[${row.locationLabel}] ${row.keterangan}`
        : `[${row.locationLabel}]`
      : row.keterangan;

    return [
      startNo + idx,
      row.namaBarang,
      row.merkTipe,
      row.nomorSeri,
      row.ukuran,
      row.bahan,
      row.tahunPerolehan,
      row.kodeBarang,
      `${row.jumlah} ${row.satuan}`,
      row.baik,
      row.kurangBaik,
      row.rusakBerat,
      ket,
    ];
  });

  return [
    header.map(escapeCsv).join(','),
    ...rows.map((r) => r.map(escapeCsv).join(',')),
  ].join('\n');
}

export function generateKirExcelHtml(
  barangList: Barang[],
  instansi: InstansiSetting,
  ruangan?: Ruangan,
  options?: {
    startUrut?: number;
    tanggalCetak?: string;
    parentRuanganName?: string;
    ruanganList?: Ruangan[];
    consolidateSameItems?: boolean;
  }
): string {
  const startUrut = options?.startUrut ?? 1;
  const tanggalCetak = options?.tanggalCetak ?? '20 November 2026';
  const ruanganList = options?.ruanganList ?? [];
  const parentName = options?.parentRuanganName;
  const consolidateSameItems = options?.consolidateSameItems ?? true;

  const namaRuanganHeader = ruangan
    ? ruangan.namaRuangan
    : parentName && parentName !== 'ALL'
    ? parentName
    : 'SELURUH RUANGAN';
  const subRuanganHeader = ruangan?.subRuangan
    ? `( ${ruangan.subRuangan} )`
    : parentName && parentName !== 'ALL'
    ? '( SEMUA SUB-RUANGAN )'
    : '( REKAPITULASI INVENTARIS )';

  const esc = (val: string | number | undefined) =>
    String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  let totalUnit = 0;
  let totalBaik = 0;
  let totalKurangBaik = 0;
  let totalRusakBerat = 0;

  const reportRows = consolidateKirReportRows(barangList, {
    ruangan,
    ruanganList,
    consolidateSameItems,
  });

  const rowsHtml = reportRows
    .map((row, idx) => {
      totalUnit += row.jumlah;
      totalBaik += row.baik;
      totalKurangBaik += row.kurangBaik;
      totalRusakBerat += row.rusakBerat;

      const locationPrefix = row.locationLabel ? `[${row.locationLabel}] ` : '';

      return `
        <tr>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${startUrut + idx}</td>
          <td style="border:1px solid #000; text-align:left; padding:4px;">${esc(row.namaBarang)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(row.merkTipe)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(row.nomorSeri)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(row.ukuran)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(row.bahan)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(row.tahunPerolehan)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px; mso-number-format:'\\@';">${esc(row.kodeBarang)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(row.jumlah)}<br/>${esc(row.satuan)}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${row.baik}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${row.kurangBaik}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${row.rusakBerat}</td>
          <td style="border:1px solid #000; text-align:center; padding:4px;">${esc(locationPrefix + row.keterangan)}</td>
        </tr>
      `;
    })
    .join('');

  const fallbackPjRoom =
    ruangan ||
    (parentName && parentName !== 'ALL'
      ? getSubRuanganByParent(ruanganList, parentName)[0]
      : undefined);

  const logoMarkup = instansi.logoUrl
    ? `<img src="${esc(instansi.logoUrl)}" width="64" height="80" alt="Logo" />`
    : '';

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>KARTU INVENTARIS RUANGAN</x:Name>
          <x:WorksheetOptions>
            <x:Print>
              <x:ValidPrinterInfo/>
              <x:PaperSizeIndex>9</x:PaperSizeIndex>
            </x:Print>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body, table { font-family: Arial, sans-serif; font-size: 10pt; }
  </style>
</head>
<body>
  <table cellspacing="0" cellpadding="2" style="width:100%; border-collapse:collapse;">
    <tr>
      <td colspan="13" style="text-align:center; font-weight:bold; font-size:12pt; padding-bottom:6px;">
        KARTU INVENTARIS RUANGAN
      </td>
    </tr>
    <tr>
      <td rowspan="5" style="text-align:center; vertical-align:middle;">${logoMarkup}</td>
      <td style="font-weight:bold; text-align:right;">PROPINSI</td>
      <td colspan="5" style="text-align:left;">: ${esc(instansi.propinsi.toUpperCase())}</td>
      <td colspan="2" style="font-weight:bold; text-align:right;">NO. KODE LOKASI</td>
      <td colspan="4" style="text-align:left; font-weight:bold; mso-number-format:'\\@';">: ${esc(instansi.kodeLokasi)}</td>
    </tr>
    <tr>
      <td style="font-weight:bold; text-align:right;">KOTA/KAB</td>
      <td colspan="5" style="text-align:left;">: ${esc(instansi.kotaKab.toUpperCase())}</td>
      <td colspan="2" style="font-weight:bold; text-align:right;">NAMA RUANGAN</td>
      <td colspan="4" style="text-align:left; font-weight:bold;">: ${esc(namaRuanganHeader.toUpperCase())}</td>
    </tr>
    <tr>
      <td style="font-weight:bold; text-align:right;">UNIT</td>
      <td colspan="5" style="text-align:left;">: ${esc(instansi.unit.toUpperCase())}</td>
      <td colspan="2"></td>
      <td colspan="4" style="text-align:left; font-weight:bold;">${esc(subRuanganHeader.toUpperCase())}</td>
    </tr>
    <tr>
      <td style="font-weight:bold; text-align:right;">SATUAN KERJA</td>
      <td colspan="5" style="text-align:left;">: ${esc(instansi.satuanKerja.toUpperCase())}</td>
      <td colspan="2" style="text-align:right;">Tahun data pelaporan</td>
      <td colspan="4" style="text-align:left;">: ${esc(instansi.tahunPelaporan)}</td>
    </tr>
    <tr>
      <td colspan="6"></td>
      <td colspan="2" style="text-align:right;">Halaman</td>
      <td colspan="4" style="text-align:left;">: ${esc(instansi.halaman)}</td>
    </tr>
    <tr><td colspan="13" style="height:8px;"></td></tr>
    <thead>
      <tr style="font-weight:bold; text-align:center; background-color:#f8fafc;">
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Urut</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Jenis barang/<br/>Nama barang</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Merk/<br/>Model</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">No.Seri Pabrik</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Ukuran</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Bahan</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Tahun<br/>Pembuatan<br/>/Pembelian</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">No.<br/>Kode barang</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Jumlah<br/>Barang</th>
        <th colspan="3" style="border:1px solid #000; padding:6px;">Keadaan Barang</th>
        <th rowspan="2" style="border:1px solid #000; padding:6px;">Keterangan</th>
      </tr>
      <tr style="font-weight:bold; text-align:center; background-color:#f8fafc;">
        <th style="border:1px solid #000; padding:4px;">Baik</th>
        <th style="border:1px solid #000; padding:4px;">Kurang<br/>Baik</th>
        <th style="border:1px solid #000; padding:4px;">Rusak<br/>Berat</th>
      </tr>
      <tr style="font-weight:bold; font-style:italic; text-align:center; background-color:#f1f5f9;">
        <th style="border:1px solid #000; padding:2px;">1</th>
        <th style="border:1px solid #000; padding:2px;">2</th>
        <th style="border:1px solid #000; padding:2px;">3</th>
        <th style="border:1px solid #000; padding:2px;">4</th>
        <th style="border:1px solid #000; padding:2px;">5</th>
        <th style="border:1px solid #000; padding:2px;">6</th>
        <th style="border:1px solid #000; padding:2px;">7</th>
        <th style="border:1px solid #000; padding:2px;">8</th>
        <th style="border:1px solid #000; padding:2px;">9</th>
        <th style="border:1px solid #000; padding:2px;">10</th>
        <th style="border:1px solid #000; padding:2px;">11</th>
        <th style="border:1px solid #000; padding:2px;">12</th>
        <th style="border:1px solid #000; padding:2px;">13</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr style="font-weight:bold; background-color:#f8fafc;">
        <td colspan="8" style="border:1px solid #000; text-align:right; padding:5px;">JUMLAH TOTAL</td>
        <td style="border:1px solid #000; text-align:center; padding:5px;">${totalUnit} UNIT</td>
        <td style="border:1px solid #000; text-align:center; padding:5px;">${totalBaik}</td>
        <td style="border:1px solid #000; text-align:center; padding:5px;">${totalKurangBaik}</td>
        <td style="border:1px solid #000; text-align:center; padding:5px;">${totalRusakBerat}</td>
        <td style="border:1px solid #000; text-align:center; padding:5px;">${reportRows.length} Jenis</td>
      </tr>
    </tbody>
  </table>
  <br/>
  <table cellspacing="0" cellpadding="2" style="width:100%;">
    <tr>
      <td colspan="4" style="text-align:center;">
        Mengetahui,<br/>
        <b>Direktur</b><br/><br/><br/><br/>
        <u><b>${esc(instansi.namaKepalaUnit)}</b></u><br/>
        NIP. ${esc(instansi.nipKepalaUnit)}
      </td>
      <td colspan="5" style="text-align:center;">
        <br/>
        <b>Penanggung Jawab Ruangan</b><br/><br/><br/><br/>
        <u><b>${esc(fallbackPjRoom ? fallbackPjRoom.penanggungJawab : instansi.namaKepalaUnit)}</b></u><br/>
        NIP. ${esc(fallbackPjRoom ? fallbackPjRoom.nipPenanggungJawab : instansi.nipKepalaUnit)}
      </td>
      <td colspan="4" style="text-align:center;">
        ${esc(instansi.kotaKab)}, ${esc(tanggalCetak)}<br/>
        <b>Pengurus Barang</b><br/><br/><br/><br/>
        <u><b>${esc(instansi.namaPengurusBarang)}</b></u><br/>
        NIP. ${esc(instansi.nipPengurusBarang)}
      </td>
    </tr>
  </table>
</body>
</html>`;
}
