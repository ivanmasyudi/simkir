import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMutasiToBarang,
  buildBarangRecordsFromConditionBreakdown,
  buildKirRoomSections,
  buildQrPayload,
  calculateKirStats,
  consolidateKirReportRows,
  evaluateRuanganDeletion,
  filterBarangList,
  formatRuanganFullLabel,
  generateAutoKodeRuangan,
  generateAutoKodeRuanganBatch,
  generateKirCsv,
  generateKirExcelHtml,
  getConditionCounts,
  getSubRuanganByParent,
  getUniqueParentRuanganNames,
  groupRuanganByParent,
  planBarangEditFromBreakdown,
  planBarangReassignmentForRoomDelete,
  resolveBarangRoom,
  validateBarangInput,
  validateMutasiInput,
  validateRuanganInput,
} from './kirLogic';
import { Barang, InstansiSetting, Mutasi, Ruangan } from '../types/kir';

const sampleInstansi: InstansiSetting = {
  propinsi: 'JAWA TIMUR',
  kotaKab: 'BANGKALAN',
  unit: 'UOBK RSUD SYARIFAH AMBAMI RATO EBU ( RSUD SYAMRABU )',
  satuanKerja: 'UOBK RSUD SYARIFAH AMBAMI RATO EBU ( RSUD SYAMRABU )',
  kodeLokasi: '13290702000000',
  tahunPelaporan: '2002 s.d 2025',
  halaman: '2',
  logoUrl: '',
  namaKepalaUnit: 'dr. H. Farhat Suryaningrat, Sp.KK',
  nipKepalaUnit: '197508142001121003',
  namaPengurusBarang: 'Rizky Pratama Putra, S.Tr.Ak',
  nipPengurusBarang: '199104222015031005',
};

const sampleRuangan: Ruangan = {
  id: 'ruang-lab-pa',
  kodeRuangan: 'R-LAB-PA',
  namaRuangan: 'INST. LABORATORIUM',
  subRuangan: 'R. PATOLOGI ANATOMI',
  gedung: 'Gedung Diagnostik Terpadu',
  lantai: 'Lantai 2',
  penanggungJawab: 'dr. Siti Rahmawati, Sp.PA',
  nipPenanggungJawab: '198405122010012008',
  unitKerja: 'Instalasi Laboratorium',
  keterangan: 'Laboratorium Patologi Anatomi RSUD Syamrabu',
  ownerId: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sampleBarangList: Barang[] = [
  {
    id: 'brg-01',
    kodeBarang: '1.3.2.05.02.01.001',
    nup: '0021',
    namaBarang: 'COMPUTER',
    merkTipe: 'DELL',
    nomorSeri: '',
    ukuran: '-',
    bahan: 'BESI',
    kategori: 'Elektronik & IT',
    tahunPerolehan: 2020,
    sumberDana: 'BLUD',
    jumlah: 2,
    satuan: 'UNIT',
    kondisi: 'Baik',
    ruanganId: 'ruang-lab-pa',
    ruanganNama: 'INST. LABORATORIUM',
    keterangan: 'Operasional laboratorium',
    ownerId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'brg-02',
    kodeBarang: '1.3.2.05.02.04.004',
    nup: '0025',
    namaBarang: 'A.C SPILIT',
    merkTipe: 'PANASONIC',
    nomorSeri: '',
    ukuran: '2PK',
    bahan: 'BESI',
    kategori: 'Pendingin & Tata Udara',
    tahunPerolehan: 2024,
    sumberDana: 'BLUD',
    jumlah: 1,
    satuan: 'UNIT',
    kondisi: 'Kurang Baik',
    ruanganId: 'ruang-102',
    ruanganNama: 'INST. RADIOLOGI',
    keterangan: 'Perlu servis berkala',
    ownerId: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

test('validateRuanganInput validates correct room and rejects invalid code', () => {
  assert.equal(validateRuanganInput(sampleRuangan).valid, true);
  assert.equal(
    validateRuanganInput({ ...sampleRuangan, kodeRuangan: 'A' }).valid,
    false
  );
  assert.equal(
    validateRuanganInput({ ...sampleRuangan, kodeRuangan: 'R-101$#@!' }).valid,
    false
  );
});

test('validateBarangInput enforces ukuran and bahan schema rules without hargaPerolehan', () => {
  assert.equal(validateBarangInput(sampleBarangList[0]).valid, true);
  assert.equal(
    validateBarangInput({ ...sampleBarangList[0], bahan: '' }).valid,
    false
  );
  assert.equal(
    validateBarangInput({ ...sampleBarangList[0], tahunPerolehan: 1950 }).valid,
    false
  );
  assert.equal(
    validateBarangInput({ ...sampleBarangList[0], jumlah: 0 }).valid,
    false
  );
});

test('validateMutasiInput validates required mutation fields', () => {
  const validMutasi: Partial<Mutasi> = {
    nomorBeritaAcara: 'BAST/KIR/2026/11/001',
    tanggalMutasi: '2026-11-20',
    barangId: 'brg-01',
    ruanganTujuanId: 'ruang-102',
    petugasInput: 'Budi Santoso',
    alasanMutasi: 'Relokasi perangkat ke instalasi radiologi',
  };
  assert.equal(validateMutasiInput(validMutasi).valid, true);
  assert.equal(
    validateMutasiInput({ ...validMutasi, nomorBeritaAcara: 'A' }).valid,
    false
  );
});

test('calculateKirStats computes unit totals and condition percentages accurately', () => {
  const stats = calculateKirStats(sampleBarangList, [sampleRuangan], []);
  assert.equal(stats.totalJenisBarang, 2);
  assert.equal(stats.totalUnitBarang, 3);
  assert.equal(stats.kondisiBaik, 2);
  assert.equal(stats.kondisiKurangBaik, 1);
  assert.equal(stats.kondisiRusakBerat, 0);
  assert.equal(stats.persenBaik, 67);
});

test('filterBarangList filters by search (including ukuran and bahan), room, category, and condition', () => {
  const byRoom = filterBarangList(sampleBarangList, { ruanganId: 'ruang-lab-pa' });
  assert.equal(byRoom.length, 1);
  assert.equal(byRoom[0].id, 'brg-01');

  const byUkuran = filterBarangList(sampleBarangList, { search: '2pk' });
  assert.equal(byUkuran.length, 1);
  assert.equal(byUkuran[0].id, 'brg-02');
});

test('applyMutasiToBarang updates room and condition immutably', () => {
  const updated = applyMutasiToBarang(
    sampleBarangList,
    {
      barangId: 'brg-01',
      ruanganTujuanId: 'ruang-102',
      ruanganTujuanNama: 'INST. RADIOLOGI',
      kondisiAkhir: 'Kurang Baik',
      alasanMutasi: 'Pindah ke instalasi radiologi',
    },
    '2026-11-20T10:00:00.000Z'
  );
  assert.equal(updated[0].ruanganId, 'ruang-102');
  assert.equal(updated[0].ruanganNama, 'INST. RADIOLOGI');
  assert.equal(updated[0].kondisi, 'Kurang Baik');
});

test('buildQrPayload, getConditionCounts, generateKirCsv, and generateKirExcelHtml produce valid output', () => {
  const qr = JSON.parse(buildQrPayload(sampleBarangList[0], '13290702000000'));
  assert.equal(qr.app, 'SIMKIR');
  assert.equal(qr.bahan, 'BESI');
  assert.equal('nup' in qr, false);

  const counts = getConditionCounts(sampleBarangList[0]);
  assert.equal(counts.baik, 2);
  assert.equal(counts.kurangBaik, 0);

  const csv = generateKirCsv(sampleBarangList, sampleRuangan, 21);
  assert.ok(csv.includes('"Ukuran"'));
  assert.ok(csv.includes('"Bahan"'));
  assert.ok(csv.includes('"2PK"'));

  const excel = generateKirExcelHtml(sampleBarangList, sampleInstansi, sampleRuangan, {
    startUrut: 21,
  });
  assert.ok(excel.includes('KARTU INVENTARIS RUANGAN'));
  assert.ok(excel.includes('JAWA TIMUR'));
  assert.ok(excel.includes('BANGKALAN'));
  assert.ok(excel.includes('R. PATOLOGI ANATOMI'));
  assert.ok(excel.includes('2PK'));
});

test('Ruangan Induk -> Sub-Ruangan hierarchy helpers group, resolve, filter, and export accurately', () => {
  const lily1: Ruangan = {
    ...sampleRuangan,
    id: 'ruang-lily-1',
    kodeRuangan: 'R-LILY-01',
    namaRuangan: 'RUANG LILY',
    subRuangan: 'RUANG LILY 1',
    gedung: 'Gedung Rawat Inap Lily',
    lantai: 'Lantai 1',
    unitKerja: 'Instalasi Rawat Inap',
  };
  const lily2: Ruangan = {
    ...lily1,
    id: 'ruang-lily-2',
    kodeRuangan: 'R-LILY-02',
    subRuangan: 'RUANG LILY 2',
  };
  const rooms = [sampleRuangan, lily1, lily2];

  const groups = groupRuanganByParent(rooms);
  assert.equal(groups.length, 2);
  assert.deepEqual(getUniqueParentRuanganNames(rooms), [
    'INST. LABORATORIUM',
    'RUANG LILY',
  ]);
  assert.equal(getSubRuanganByParent(rooms, 'RUANG LILY').length, 2);
  assert.equal(formatRuanganFullLabel(lily1), 'RUANG LILY — RUANG LILY 1');

  const lilyBarang1: Barang = {
    ...sampleBarangList[0],
    id: 'brg-lily-1',
    namaBarang: 'BED PASIEN ELECTRIC',
    ruanganId: 'ruang-lily-1',
    ruanganNama: 'RUANG LILY — RUANG LILY 1',
    jumlah: 4,
    kondisi: 'Baik',
  };
  const lilyBarang2: Barang = {
    ...sampleBarangList[0],
    id: 'brg-lily-2',
    namaBarang: 'PATIENT MONITOR',
    ruanganId: 'ruang-lily-2',
    ruanganNama: 'RUANG LILY — RUANG LILY 2',
    jumlah: 2,
    kondisi: 'Baik',
  };
  const allBarang = [sampleBarangList[0], lilyBarang1, lilyBarang2];

  const resolved = resolveBarangRoom(lilyBarang2, rooms);
  assert.equal(resolved.parentName, 'RUANG LILY');
  assert.equal(resolved.subName, 'RUANG LILY 2');
  assert.equal(resolved.fullLabel, 'RUANG LILY — RUANG LILY 2');

  const stats = calculateKirStats(allBarang, rooms, []);
  assert.equal(stats.totalParentRuangan, 2);
  assert.equal(stats.totalRuangan, 3);

  // Filter by parent room RUANG LILY returns items in both RUANG LILY 1 and RUANG LILY 2
  const allLilyItems = filterBarangList(allBarang, {
    parentRuanganName: 'RUANG LILY',
    ruanganList: rooms,
  });
  assert.equal(allLilyItems.length, 2);

  // Filter by specific sub-room RUANG LILY 2 returns only its item
  const onlyLily2 = filterBarangList(allBarang, {
    parentRuanganName: 'RUANG LILY',
    ruanganId: 'ruang-lily-2',
    ruanganList: rooms,
  });
  assert.equal(onlyLily2.length, 1);
  assert.equal(onlyLily2[0].id, 'brg-lily-2');

  // Search matches sub-ruangan name
  const searchBySub = filterBarangList(allBarang, {
    search: 'lily 2',
    ruanganList: rooms,
  });
  assert.equal(searchBySub.length, 1);
  assert.equal(searchBySub[0].id, 'brg-lily-2');

  // QR payload embeds subRuang
  const qr = JSON.parse(buildQrPayload(lilyBarang1, '13290702000000', lily1));
  assert.equal(qr.ruang, 'RUANG LILY');
  assert.equal(qr.subRuang, 'RUANG LILY 1');

  // Excel HTML for whole parent room RUANG LILY
  const excelParent = generateKirExcelHtml(allLilyItems, sampleInstansi, undefined, {
    parentRuanganName: 'RUANG LILY',
    ruanganList: rooms,
  });
  assert.ok(excelParent.includes('RUANG LILY'));
  assert.ok(excelParent.includes('SEMUA SUB-RUANGAN'));
  assert.ok(excelParent.includes('[RUANG LILY 1]'));
  assert.ok(excelParent.includes('[RUANG LILY 2]'));
});

test('Opsi B: buildBarangRecordsFromConditionBreakdown splits mixed conditions with sequential NUPs and consolidateKirReportRows merges them into 1 KIR row', () => {
  const records = buildBarangRecordsFromConditionBreakdown(
    {
      kodeBarang: '1.3.2.05.02.02.003',
      namaBarang: 'PRINTER EPSON',
      merkTipe: 'L3210',
      nomorSeri: '',
      ukuran: 'A4',
      bahan: 'PLASTIK',
      kategori: 'Elektronik & IT',
      tahunPerolehan: 2024,
      sumberDana: 'BLUD',
      satuan: 'UNIT',
      ruanganId: 'ruang-lily-1',
      ruanganNama: 'RUANG LILY — RUANG LILY 1',
      keterangan: 'Meja perawat',
      ownerId: 'user-1',
      createdAt: '2026-11-21T00:00:00.000Z',
      updatedAt: '2026-11-21T00:00:00.000Z',
    },
    '0036',
    { baik: 2, kurangBaik: 0, rusakBerat: 1 },
    'test'
  );

  assert.equal(records.length, 2);
  assert.equal(records[0].kondisi, 'Baik');
  assert.equal(records[0].jumlah, 2);
  assert.equal(records[0].nup, '0036');
  assert.equal(records[1].kondisi, 'Rusak Berat');
  assert.equal(records[1].jumlah, 1);
  assert.equal(records[1].nup, '0037');
  assert.equal(validateBarangInput(records[0]).valid, true);
  assert.equal(validateBarangInput(records[1]).valid, true);

  const consolidated = consolidateKirReportRows(records, {
    consolidateSameItems: true,
  });
  assert.equal(consolidated.length, 1);
  assert.equal(consolidated[0].jumlah, 3);
  assert.equal(consolidated[0].baik, 2);
  assert.equal(consolidated[0].kurangBaik, 0);
  assert.equal(consolidated[0].rusakBerat, 1);

  const detailed = consolidateKirReportRows(records, {
    consolidateSameItems: false,
  });
  assert.equal(detailed.length, 2);

  const excel = generateKirExcelHtml(records, sampleInstansi, sampleRuangan, {
    startUrut: 1,
    consolidateSameItems: true,
  });
  assert.ok(excel.includes('PRINTER EPSON'));
  assert.ok(excel.includes('3<br/>UNIT'));
  assert.ok(excel.includes('>2<'));
  assert.ok(excel.includes('>1<'));
});

test('generateAutoKodeRuangan and generateAutoKodeRuanganBatch produce deterministic unique room codes', () => {
  const existing: Ruangan[] = [
    {
      ...sampleRuangan,
      id: 'ruang-lily-1',
      kodeRuangan: 'R-LILY-01',
      namaRuangan: 'RUANG LILY',
      subRuangan: 'RUANG LILY 1',
    },
    {
      ...sampleRuangan,
      id: 'ruang-lily-2',
      kodeRuangan: 'R-LILY-02',
      namaRuangan: 'RUANG LILY',
      subRuangan: 'RUANG LILY 2',
    },
    {
      ...sampleRuangan,
      id: 'ruang-lab-pa',
      kodeRuangan: 'R-LAB-01',
      namaRuangan: 'INST. LABORATORIUM',
      subRuangan: 'R. PATOLOGI ANATOMI',
    },
  ];

  // Next sub-room under existing parent reuses prefix and increments
  assert.equal(generateAutoKodeRuangan('RUANG LILY', existing), 'R-LILY-03');
  assert.equal(
    generateAutoKodeRuangan('INST. LABORATORIUM', existing),
    'R-LAB-02'
  );

  // New parent room strips generic word "RUANG" and generates sequential batch
  assert.deepEqual(generateAutoKodeRuanganBatch('RUANG MAWAR', 3, existing), [
    'R-MAWAR-01',
    'R-MAWAR-02',
    'R-MAWAR-03',
  ]);

  // Empty parent falls back cleanly to R-RNG-01
  assert.equal(generateAutoKodeRuangan('', existing), 'R-RNG-01');
});

test('planBarangEditFromBreakdown handles single-condition updates and multi-condition splits while preserving original ID', () => {
  const existingItem: Barang = {
    ...sampleBarangList[0],
    id: 'brg-existing-01',
    nup: '0005',
    jumlah: 3,
    kondisi: 'Baik',
    ownerId: 'uid-owner-1',
    createdAt: '2026-01-10T00:00:00.000Z',
  };

  const basePayload: Omit<
    Barang,
    'id' | 'jumlah' | 'kondisi' | 'nup' | 'ownerId' | 'createdAt'
  > = {
    kodeBarang: '1.3.2.05.02.04.004',
    namaBarang: 'A.C SPLIT',
    merkTipe: 'PANASONIC',
    nomorSeri: 'SN-AC-01',
    ukuran: '2 PK',
    bahan: 'CAMPURAN',
    kategori: 'Pendingin & Tata Udara',
    tahunPerolehan: 2024,
    sumberDana: 'BLUD',
    satuan: 'UNIT',
    ruanganId: existingItem.ruanganId,
    ruanganNama: existingItem.ruanganNama,
    keterangan: 'Diperbarui dari form edit',
    updatedAt: '2026-03-01T10:00:00.000Z',
  };

  // All-zero breakdown returns null
  assert.equal(
    planBarangEditFromBreakdown(existingItem, basePayload, {
      baik: 0,
      kurangBaik: 0,
      rusakBerat: 0,
    }),
    null
  );

  // Changing condition from Baik -> Rusak Berat preserves document ID without extra records
  const singleChanged = planBarangEditFromBreakdown(
    existingItem,
    basePayload,
    { baik: 0, kurangBaik: 0, rusakBerat: 2 },
    '54321'
  );
  assert.ok(singleChanged);
  assert.equal(singleChanged.updatedRecord.id, 'brg-existing-01');
  assert.equal(singleChanged.updatedRecord.kondisi, 'Rusak Berat');
  assert.equal(singleChanged.updatedRecord.jumlah, 2);
  assert.equal(singleChanged.updatedRecord.ownerId, 'uid-owner-1');
  assert.equal(singleChanged.updatedRecord.createdAt, '2026-01-10T00:00:00.000Z');
  assert.equal(singleChanged.createdRecords.length, 0);

  // Splitting into 2 Baik + 1 Kurang Baik + 1 Rusak Berat preserves ID on original condition (Baik) and creates 2 extra records
  const splitPlan = planBarangEditFromBreakdown(
    existingItem,
    basePayload,
    { baik: 2, kurangBaik: 1, rusakBerat: 1 },
    '99999'
  );
  assert.ok(splitPlan);
  assert.equal(splitPlan.updatedRecord.id, 'brg-existing-01');
  assert.equal(splitPlan.updatedRecord.kondisi, 'Baik');
  assert.equal(splitPlan.updatedRecord.jumlah, 2);
  assert.equal(splitPlan.createdRecords.length, 2);
  assert.equal(splitPlan.createdRecords[0].kondisi, 'Kurang Baik');
  assert.equal(splitPlan.createdRecords[0].jumlah, 1);
  assert.equal(splitPlan.createdRecords[1].kondisi, 'Rusak Berat');
  assert.equal(splitPlan.createdRecords[1].jumlah, 1);
  assert.notEqual(splitPlan.createdRecords[0].id, 'brg-existing-01');
  assert.notEqual(splitPlan.createdRecords[1].id, splitPlan.createdRecords[0].id);
});

test('evaluateRuanganDeletion blocks direct delete for occupied rooms and planBarangReassignmentForRoomDelete reassigns cleanly', () => {
  const roomOccupied: Ruangan = {
    ...sampleRuangan,
    id: 'ruang-occupied',
    kodeRuangan: 'R-LAB-01',
    namaRuangan: 'INST. LABORATORIUM',
    subRuangan: 'R. PATOLOGI ANATOMI',
  };
  const roomEmpty: Ruangan = {
    ...sampleRuangan,
    id: 'ruang-empty',
    kodeRuangan: 'R-LAB-02',
    namaRuangan: 'INST. LABORATORIUM',
    subRuangan: 'R. PATOLOGI KLINIK',
  };

  const barangInOccupied: Barang[] = [
    { ...sampleBarangList[0], id: 'b1', ruanganId: 'ruang-occupied', jumlah: 2 },
    { ...sampleBarangList[1], id: 'b2', ruanganId: 'ruang-occupied', jumlah: 3 },
  ];

  // Empty room can be deleted directly
  const emptyCheck = evaluateRuanganDeletion(
    roomEmpty,
    [roomOccupied, roomEmpty],
    barangInOccupied
  );
  assert.equal(emptyCheck.canDeleteDirectly, true);
  assert.equal(emptyCheck.barangCount, 0);
  assert.equal(emptyCheck.totalUnits, 0);
  assert.equal(emptyCheck.isBlockedNoDestination, false);

  // Occupied room with another room available must reassign first
  const occupiedCheck = evaluateRuanganDeletion(
    roomOccupied,
    [roomOccupied, roomEmpty],
    barangInOccupied
  );
  assert.equal(occupiedCheck.canDeleteDirectly, false);
  assert.equal(occupiedCheck.barangCount, 2);
  assert.equal(occupiedCheck.totalUnits, 5);
  assert.equal(occupiedCheck.canReassignAndDelete, true);
  assert.equal(occupiedCheck.availableDestinations.length, 1);
  assert.equal(occupiedCheck.availableDestinations[0].id, 'ruang-empty');

  // Occupied room when it is the ONLY room is completely blocked
  const soleRoomCheck = evaluateRuanganDeletion(
    roomOccupied,
    [roomOccupied],
    barangInOccupied
  );
  assert.equal(soleRoomCheck.canDeleteDirectly, false);
  assert.equal(soleRoomCheck.canReassignAndDelete, false);
  assert.equal(soleRoomCheck.isBlockedNoDestination, true);

  // Reassignment updates ruanganId & ruanganNama without altering asset identity
  const moved = planBarangReassignmentForRoomDelete(
    roomOccupied,
    roomEmpty,
    barangInOccupied,
    '2026-11-23T16:00:00.000Z'
  );
  assert.equal(moved.length, 2);
  assert.equal(moved[0].id, 'b1');
  assert.equal(moved[0].ruanganId, 'ruang-empty');
  assert.equal(moved[0].ruanganNama, 'INST. LABORATORIUM — R. PATOLOGI KLINIK');
  assert.equal(moved[0].jumlah, 2);
  assert.equal(moved[1].ruanganId, 'ruang-empty');

  // Same-room reassignment throws
  assert.throws(() =>
    planBarangReassignmentForRoomDelete(
      roomOccupied,
      roomOccupied,
      barangInOccupied,
      '2026-11-23T16:00:00.000Z'
    )
  );
});

test('buildKirRoomSections separates rooms with per-room PJ and skips/includes empty rooms cleanly', () => {
  const roomA: Ruangan = {
    ...sampleRuangan,
    id: 'r-a',
    kodeRuangan: 'R-LAB-01',
    namaRuangan: 'INST. LABORATORIUM',
    subRuangan: 'R. PATOLOGI ANATOMI',
    penanggungJawab: 'dr. Andi Sp.PA',
    nipPenanggungJawab: '198001012010011001',
  };
  const roomB: Ruangan = {
    ...sampleRuangan,
    id: 'r-b',
    kodeRuangan: 'R-LAB-02',
    namaRuangan: 'INST. LABORATORIUM',
    subRuangan: 'R. PATOLOGI KLINIK',
    penanggungJawab: 'dr. Budi Sp.PK',
    nipPenanggungJawab: '198102022011011002',
  };
  const roomEmpty: Ruangan = {
    ...sampleRuangan,
    id: 'r-empty',
    kodeRuangan: 'R-RAD-01',
    namaRuangan: 'INST. RADIOLOGI',
    subRuangan: 'R. CT-SCAN',
    penanggungJawab: 'dr. Citra Sp.Rad',
    nipPenanggungJawab: '198203032012012003',
  };

  const rooms = [roomA, roomB, roomEmpty];
  const items: Barang[] = [
    { ...sampleBarangList[0], id: 'it-1', ruanganId: 'r-a', jumlah: 2, kondisi: 'Baik' },
    { ...sampleBarangList[1], id: 'it-2', ruanganId: 'r-b', jumlah: 4, kondisi: 'Kurang Baik' },
  ];

  // 1. Default split mode across ALL rooms skips empty rooms
  const splitNonEmpty = buildKirRoomSections(items, rooms, {
    selectedParentName: 'ALL',
    selectedRuanganId: 'ALL',
    splitByRoom: true,
    includeEmptyRooms: false,
  });
  assert.equal(splitNonEmpty.length, 2);
  assert.equal(splitNonEmpty[0].ruangan?.id, 'r-a');
  assert.equal(splitNonEmpty[0].subRuanganLabel, '( R. PATOLOGI ANATOMI )');
  assert.equal(splitNonEmpty[0].penanggungJawab, 'dr. Andi Sp.PA');
  assert.equal(splitNonEmpty[0].rows[0].locationLabel, '');
  assert.equal(splitNonEmpty[1].ruangan?.id, 'r-b');
  assert.equal(splitNonEmpty[1].penanggungJawab, 'dr. Budi Sp.PK');
  assert.equal(splitNonEmpty[1].countKurangBaik, 4);

  // 2. includeEmptyRooms=true includes R. CT-SCAN with 0 rows
  const splitWithEmpty = buildKirRoomSections(items, rooms, {
    selectedParentName: 'ALL',
    selectedRuanganId: 'ALL',
    splitByRoom: true,
    includeEmptyRooms: true,
  });
  assert.equal(splitWithEmpty.length, 3);
  assert.equal(splitWithEmpty[2].ruangan?.id, 'r-empty');
  assert.equal(splitWithEmpty[2].rows.length, 0);

  // 3. Combined mode produces 1 merged recap section with location labels
  const combined = buildKirRoomSections(items, rooms, {
    selectedParentName: 'ALL',
    selectedRuanganId: 'ALL',
    splitByRoom: false,
  });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].namaRuangan, 'SELURUH RUANGAN');
  assert.equal(combined[0].totalUnits, 6);
  assert.ok(combined[0].rows[0].locationLabel.length > 0);

  // 4. Single empty room selected directly still returns 1 section so empty state renders
  const singleEmpty = buildKirRoomSections(items, rooms, {
    selectedParentName: 'INST. RADIOLOGI',
    selectedRuanganId: 'r-empty',
    splitByRoom: true,
    includeEmptyRooms: false,
  });
  assert.equal(singleEmpty.length, 1);
  assert.equal(singleEmpty[0].ruangan?.id, 'r-empty');
  assert.equal(singleEmpty[0].rows.length, 0);
});






