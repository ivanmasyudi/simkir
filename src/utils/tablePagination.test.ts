import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPageNumbers,
  paginateItems,
  sortBarangList,
  sortMutasiList,
} from './tablePagination';
import { Barang, Mutasi, Ruangan } from '../types/kir';

const sampleRuangan: Ruangan[] = [
  {
    id: 'r-1',
    kodeRuangan: 'R-LY-01',
    namaRuangan: 'RUANG LILY',
    subRuangan: 'RUANG LILY 1',
    gedung: 'Gedung A',
    lantai: 'Lantai 1',
    penanggungJawab: 'Dewi',
    nipPenanggungJawab: '111',
    unitKerja: 'Rawat Inap',
    keterangan: '',
    ownerId: 'u1',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r-2',
    kodeRuangan: 'R-IG-01',
    namaRuangan: 'INST. GAWAT DARURAT',
    subRuangan: 'TRIASE IGD',
    gedung: 'Gedung B',
    lantai: 'Lantai 1',
    penanggungJawab: 'Budi',
    nipPenanggungJawab: '222',
    unitKerja: 'IGD',
    keterangan: '',
    ownerId: 'u1',
    createdAt: '',
    updatedAt: '',
  },
];

const makeBarang = (overrides: Partial<Barang>): Barang => ({
  id: 'b-1',
  kodeBarang: '1.3.2.05.01',
  nup: '0001',
  namaBarang: 'Barang A',
  merkTipe: 'Merk A',
  nomorSeri: '',
  ukuran: '',
  bahan: 'BESI',
  kategori: 'Elektronik & IT',
  tahunPerolehan: 2024,
  sumberDana: 'BLUD',
  jumlah: 1,
  satuan: 'UNIT',
  kondisi: 'Baik',
  ruanganId: 'r-1',
  ruanganNama: 'RUANG LILY — RUANG LILY 1',
  keterangan: '',
  ownerId: 'u1',
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

test('paginateItems handles empty arrays safely', () => {
  const res = paginateItems([], 3, 10);
  assert.deepEqual(res.pageItems, []);
  assert.equal(res.safePage, 1);
  assert.equal(res.totalPages, 1);
  assert.equal(res.startDisplay, 0);
  assert.equal(res.endDisplay, 0);
});

test('paginateItems slices pages and clamps out-of-range page numbers', () => {
  const items = Array.from({ length: 35 }, (_, i) => i + 1);

  const p1 = paginateItems(items, 1, 10);
  assert.equal(p1.pageItems.length, 10);
  assert.equal(p1.pageItems[0], 1);
  assert.equal(p1.pageItems[9], 10);
  assert.equal(p1.totalPages, 4);
  assert.equal(p1.startDisplay, 1);
  assert.equal(p1.endDisplay, 10);

  const p4 = paginateItems(items, 4, 10);
  assert.deepEqual(p4.pageItems, [31, 32, 33, 34, 35]);
  assert.equal(p4.startDisplay, 31);
  assert.equal(p4.endDisplay, 35);

  // Page exceeds totalPages (e.g. after deleting last item on page 5)
  const clampedHigh = paginateItems(items, 99, 10);
  assert.equal(clampedHigh.safePage, 4);
  assert.deepEqual(clampedHigh.pageItems, [31, 32, 33, 34, 35]);

  // Page below 1
  const clampedLow = paginateItems(items, 0, 10);
  assert.equal(clampedLow.safePage, 1);
  assert.equal(clampedLow.pageItems[0], 1);
});

test('buildPageNumbers renders full list for <=7 pages and smart ellipsis for >7 pages', () => {
  assert.deepEqual(buildPageNumbers(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(buildPageNumbers(1, 12), [1, 2, 'ellipsis', 12]);
  assert.deepEqual(buildPageNumbers(6, 12), [
    1,
    'ellipsis',
    5,
    6,
    7,
    'ellipsis',
    12,
  ]);
  assert.deepEqual(buildPageNumbers(12, 12), [1, 'ellipsis', 11, 12]);
});

test('sortBarangList sorts immutably by nama, tahun, jumlah, kondisi, and ruangan', () => {
  const list: Barang[] = [
    makeBarang({
      id: 'b1',
      namaBarang: 'Kursi Pasien',
      tahunPerolehan: 2021,
      jumlah: 8,
      kondisi: 'Rusak Berat',
      ruanganId: 'r-1',
    }),
    makeBarang({
      id: 'b2',
      namaBarang: 'AC Split 2PK',
      tahunPerolehan: 2025,
      jumlah: 2,
      kondisi: 'Baik',
      ruanganId: 'r-2',
    }),
    makeBarang({
      id: 'b3',
      namaBarang: 'Monitor ICU',
      tahunPerolehan: 2023,
      jumlah: 5,
      kondisi: 'Kurang Baik',
      ruanganId: 'r-2',
    }),
  ];

  const byNamaAsc = sortBarangList(list, 'namaBarang', 'asc', sampleRuangan);
  assert.deepEqual(
    byNamaAsc.map((b) => b.id),
    ['b2', 'b1', 'b3']
  );

  const byJumlahDesc = sortBarangList(list, 'jumlah', 'desc', sampleRuangan);
  assert.deepEqual(
    byJumlahDesc.map((b) => b.id),
    ['b1', 'b3', 'b2']
  );

  const byTahunDesc = sortBarangList(
    list,
    'tahunPerolehan',
    'desc',
    sampleRuangan
  );
  assert.deepEqual(
    byTahunDesc.map((b) => b.id),
    ['b2', 'b3', 'b1']
  );

  const byKondisiAsc = sortBarangList(list, 'kondisi', 'asc', sampleRuangan);
  assert.deepEqual(
    byKondisiAsc.map((b) => b.id),
    ['b2', 'b3', 'b1']
  );

  const byRuanganAsc = sortBarangList(list, 'ruangan', 'asc', sampleRuangan);
  // INST. GAWAT DARURAT comes before RUANG LILY
  assert.equal(byRuanganAsc[2].id, 'b1');

  // Original array not mutated
  assert.equal(list[0].id, 'b1');
});

test('sortMutasiList sorts by tanggalMutasi descending and ascending', () => {
  const makeMutasi = (id: string, tanggalMutasi: string, namaBarang: string): Mutasi => ({
    id,
    nomorBeritaAcara: `BAST/${id}`,
    tanggalMutasi,
    jenisMutasi: 'Perpindahan Ruangan',
    barangId: 'b1',
    kodeBarang: '1.3.2',
    namaBarang,
    ruanganAsalId: 'r-1',
    ruanganAsalNama: 'RUANG LILY',
    ruanganTujuanId: 'r-2',
    ruanganTujuanNama: 'IGD',
    kondisiAwal: 'Baik',
    kondisiAkhir: 'Baik',
    petugasInput: 'Rizky',
    alasanMutasi: 'Relokasi',
    ownerId: 'u1',
    createdAt: `${tanggalMutasi}T08:00:00.000Z`,
  });

  const rows = [
    makeMutasi('m1', '2026-01-10', 'Printer'),
    makeMutasi('m2', '2026-11-20', 'AC Split'),
    makeMutasi('m3', '2026-05-15', 'Monitor'),
  ];

  const desc = sortMutasiList(rows, 'tanggalMutasi', 'desc');
  assert.deepEqual(
    desc.map((m) => m.id),
    ['m2', 'm3', 'm1']
  );

  const byNama = sortMutasiList(rows, 'namaBarang', 'asc');
  assert.deepEqual(
    byNama.map((m) => m.id),
    ['m2', 'm3', 'm1']
  );
});
