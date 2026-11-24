import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  DEFAULT_INSTANSI_SETTING,
  INITIAL_BARANG_LIST,
  INITIAL_RUANGAN_LIST,
} from '../data/seedData';
import {
  buildKirExcelBuffer,
  computeKirPrintPageMeta,
} from './kirExcelExport';

// 1x1 valid PNG pixel base64 for deterministic Node.js image embedding verification
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('computeKirPrintPageMeta calculates single and multi-page labels automatically', () => {
  assert.deepEqual(computeKirPrintPageMeta(0), {
    totalPrintPages: 1,
    kopLabel: '1',
  });
  assert.deepEqual(computeKirPrintPageMeta(1), {
    totalPrintPages: 1,
    kopLabel: '1',
  });
  assert.deepEqual(computeKirPrintPageMeta(20), {
    totalPrintPages: 1,
    kopLabel: '1',
  });
  assert.deepEqual(computeKirPrintPageMeta(21), {
    totalPrintPages: 2,
    kopLabel: '1 s.d 2',
  });
  assert.deepEqual(computeKirPrintPageMeta(45), {
    totalPrintPages: 3,
    kopLabel: '1 s.d 3',
  });
});

test('buildKirExcelBuffer produces native .xlsx matching KIR preview: logo, automatic Urut & Halaman, 13 columns, totals, and Direktur/PJ/Pengurus Barang signatures', async () => {
  const ruangan = INITIAL_RUANGAN_LIST[0]; // INST. LABORATORIUM -> R. PATOLOGI ANATOMI
  const items = INITIAL_BARANG_LIST.filter((b) => b.ruanganId === ruangan.id);

  const instansi = {
    ...DEFAULT_INSTANSI_SETTING,
    halaman: '99', // Legacy manual field must be ignored in favor of automatic Halaman
    namaKepalaUnit: 'dr. H. Ahmad Direksi, Sp.PD',
    nipKepalaUnit: '197001012000031001',
    namaPengurusBarang: 'Budi Pengurus, S.E.',
    nipPengurusBarang: '199002022015031002',
    logoUrl: TINY_PNG_DATA_URL,
  };

  const buffer = await buildKirExcelBuffer(items, instansi, ruangan, {
    tanggalCetak: '22 November 2026',
    parentRuanganName: ruangan.namaRuangan,
    ruanganList: INITIAL_RUANGAN_LIST,
    consolidateSameItems: true,
    logoBase64: TINY_PNG_DATA_URL,
    logoExtension: 'png',
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet('KARTU INVENTARIS RUANGAN');
  assert.ok(ws, 'Worksheet KARTU INVENTARIS RUANGAN must exist');

  // 1. Embedded logo image present
  const images = ws.getImages();
  assert.equal(images.length, 1, 'Logo image must be embedded natively in Excel');

  // 2. Title & Kop Kiri + Kop Kanan exact parity (with automatic Halaman)
  assert.equal(ws.getCell('A1').value, 'KARTU INVENTARIS RUANGAN');
  assert.equal(ws.getCell('B3').value, 'PROPINSI');
  assert.equal(ws.getCell('C3').value, `: ${instansi.propinsi.toUpperCase()}`);
  assert.equal(ws.getCell('B4').value, 'KOTA/KAB');
  assert.equal(ws.getCell('C4').value, `: ${instansi.kotaKab.toUpperCase()}`);
  assert.equal(ws.getCell('B5').value, 'UNIT');
  assert.equal(ws.getCell('C5').value, `: ${instansi.unit.toUpperCase()}`);
  assert.equal(ws.getCell('B6').value, 'SATUAN KERJA');
  assert.equal(ws.getCell('C6').value, `: ${instansi.satuanKerja.toUpperCase()}`);

  assert.equal(ws.getCell('H3').value, 'NO. KODE LOKASI');
  assert.equal(ws.getCell('J3').value, `: ${instansi.kodeLokasi}`);
  assert.equal(ws.getCell('H4').value, 'NAMA RUANGAN');
  assert.equal(ws.getCell('J4').value, `: ${ruangan.namaRuangan.toUpperCase()}`);
  assert.equal(ws.getCell('J5').value, `  ( ${ruangan.subRuangan.toUpperCase()} )`);
  assert.equal(ws.getCell('H6').value, 'Tahun data pelaporan');
  assert.equal(ws.getCell('J6').value, `: ${instansi.tahunPelaporan}`);
  assert.equal(ws.getCell('H7').value, 'Halaman');
  assert.equal(ws.getCell('J7').value, ': 1');

  // Native Excel print header repeat + automatic page footer
  assert.equal(ws.pageSetup.printTitlesRow, '9:11');
  assert.ok(
    ws.headerFooter.oddFooter?.includes('&P') &&
      ws.headerFooter.oddFooter?.includes('&N'),
    'Excel print footer must include dynamic &P and &N page placeholders'
  );

  // 3. Exact 13-column headers + column numbering 1..13
  assert.equal(ws.getCell('A9').value, 'Urut');
  assert.equal(ws.getCell('J9').value, 'Keadaan Barang');
  assert.equal(ws.getCell('J10').value, 'Baik');
  assert.equal(ws.getCell('K10').value, 'Kurang\nBaik');
  assert.equal(ws.getCell('L10').value, 'Rusak\nBerat');
  for (let col = 1; col <= 13; col++) {
    assert.equal(ws.getCell(11, col).value, col);
  }

  // 4. First data row automatically starts at 1 & Totals row parity
  assert.equal(ws.getCell('A12').value, 1);
  const totalRowIdx = 12 + items.length;
  assert.equal(ws.getCell(`A${totalRowIdx}`).value, 'JUMLAH TOTAL');
  assert.equal(ws.getCell(`M${totalRowIdx}`).value, `${items.length} Jenis`);

  // 5. 3-Pejabat Signature Block parity (Direktur, Penanggung Jawab Ruangan, Pengurus Barang)
  const sigTopRow = totalRowIdx + 2;
  const sigRoleRow = sigTopRow + 1;
  const sigNameRow = sigRoleRow + 4;
  const sigNipRow = sigNameRow + 1;

  assert.equal(ws.getCell(`A${sigTopRow}`).value, 'Mengetahui,');
  assert.equal(ws.getCell(`A${sigRoleRow}`).value, 'Direktur');
  assert.equal(ws.getCell(`A${sigNameRow}`).value, instansi.namaKepalaUnit);
  assert.equal(ws.getCell(`A${sigNipRow}`).value, `NIP. ${instansi.nipKepalaUnit}`);

  assert.equal(ws.getCell(`E${sigRoleRow}`).value, 'Penanggung Jawab Ruangan');
  assert.equal(ws.getCell(`E${sigNameRow}`).value, ruangan.penanggungJawab);
  assert.equal(ws.getCell(`E${sigNipRow}`).value, `NIP. ${ruangan.nipPenanggungJawab}`);

  assert.equal(ws.getCell(`J${sigTopRow}`).value, `${instansi.kotaKab}, 22 November 2026`);
  assert.equal(ws.getCell(`J${sigRoleRow}`).value, 'Pengurus Barang');
  assert.equal(ws.getCell(`J${sigNameRow}`).value, instansi.namaPengurusBarang);
  assert.equal(ws.getCell(`J${sigNipRow}`).value, `NIP. ${instansi.nipPengurusBarang}`);
});

test('buildKirExcelBuffer automatically numbers 1..45 and sets multi-page Kop Halaman 1 s.d 3', async () => {
  const ruangan = INITIAL_RUANGAN_LIST[0];
  const baseItem = INITIAL_BARANG_LIST[0];
  const manyItems = Array.from({ length: 45 }, (_, i) => ({
    ...baseItem,
    id: `auto-item-${i + 1}`,
    ruanganId: ruangan.id,
    namaBarang: `Peralatan Medis Seri ${i + 1}`,
    kodeBarang: `3.10.01.${String(i + 1).padStart(3, '0')}`,
    nup: String(i + 1).padStart(4, '0'),
  }));

  const buffer = await buildKirExcelBuffer(
    manyItems,
    DEFAULT_INSTANSI_SETTING,
    ruangan,
    {
      tanggalCetak: '22 November 2026',
      parentRuanganName: ruangan.namaRuangan,
      ruanganList: INITIAL_RUANGAN_LIST,
      consolidateSameItems: false,
    }
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('KARTU INVENTARIS RUANGAN')!;

  assert.equal(ws.getCell('J7').value, ': 1 s.d 3');
  assert.equal(ws.getCell('A12').value, 1);
  assert.equal(ws.getCell('A56').value, 45);
});

test('buildKirExcelBuffer resolves fallbackPjRoom from parent room when semua sub-ruang selected', async () => {
  const lilySubs = INITIAL_RUANGAN_LIST.filter((r) => r.namaRuangan === 'RUANG LILY');
  assert.ok(lilySubs.length >= 1);
  const lilySubIds = new Set(lilySubs.map((r) => r.id));
  const lilyItems = INITIAL_BARANG_LIST.filter((b) => lilySubIds.has(b.ruanganId));

  const buffer = await buildKirExcelBuffer(
    lilyItems,
    DEFAULT_INSTANSI_SETTING,
    undefined,
    {
      tanggalCetak: '22 November 2026',
      parentRuanganName: 'RUANG LILY',
      ruanganList: INITIAL_RUANGAN_LIST,
      consolidateSameItems: true,
    }
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('KARTU INVENTARIS RUANGAN')!;

  assert.equal(ws.getCell('J4').value, ': RUANG LILY');
  assert.equal(ws.getCell('J5').value, '  ( SEMUA SUB-RUANGAN )');

  // Locate Penanggung Jawab Ruangan signature name cell
  let foundPjName = false;
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value === lilySubs[0].penanggungJawab) {
        foundPjName = true;
      }
    });
  });
  assert.equal(
    foundPjName,
    true,
    'Excel signature must match preview fallbackPjRoom penanggungJawab'
  );
});

test('buildKirExcelBuffer (Opsi 1) exports multiple rooms onto 1 lightweight sheet with reused single logo, per-room Urut reset, per-room PJ, and horizontal page breaks', async () => {
  const buffer = await buildKirExcelBuffer(
    INITIAL_BARANG_LIST,
    DEFAULT_INSTANSI_SETTING,
    undefined,
    {
      tanggalCetak: '23 November 2026',
      parentRuanganName: 'ALL',
      ruanganList: INITIAL_RUANGAN_LIST,
      consolidateSameItems: true,
      splitByRoom: true,
      includeEmptyRooms: false,
      logoBase64: TINY_PNG_DATA_URL,
      logoExtension: 'png',
    }
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Must remain exactly 1 worksheet so even 100+ rooms stay lightweight in Excel
  assert.equal(wb.worksheets.length, 1, 'Multi-room Opsi 1 export must use exactly 1 worksheet');
  const ws = wb.getWorksheet('KARTU INVENTARIS RUANGAN')!;
  assert.ok(ws);

  // Count how many rooms have at least 1 barang in seed data
  const occupiedRooms = INITIAL_RUANGAN_LIST.filter((r) =>
    INITIAL_BARANG_LIST.some((b) => b.ruanganId === r.id)
  );
  assert.ok(occupiedRooms.length >= 2, 'Seed data must have multiple occupied rooms');

  // Verify printTitlesRow is NOT pinned to 9:11 in multi-room mode (so rooms 2..N don't get stray headers above their Kop)
  assert.equal(ws.pageSetup.printTitlesRow, undefined);

  // Verify every occupied room has its own KARTU INVENTARIS RUANGAN title, Kop sub-ruangan, Urut reset to 1, and PJ signature
  const titleRows: number[] = [];
  const foundSubRooms = new Set<string>();
  const foundPjNames = new Set<string>();
  ws.eachRow((row, rowNumber) => {
    const colA = row.getCell(1).value;
    if (colA === 'KARTU INVENTARIS RUANGAN') {
      titleRows.push(rowNumber);
    }
    const colJ = String(row.getCell(10).value ?? '');
    for (const r of occupiedRooms) {
      if (r.subRuangan && colJ.includes(r.subRuangan.toUpperCase())) {
        foundSubRooms.add(r.id);
      }
    }
    const colE = String(row.getCell(5).value ?? '');
    for (const r of occupiedRooms) {
      if (colE === r.penanggungJawab) {
        foundPjNames.add(r.id);
      }
    }
  });

  assert.equal(titleRows.length, occupiedRooms.length);
  assert.equal(foundSubRooms.size, occupiedRooms.length);
  assert.equal(foundPjNames.size, occupiedRooms.length);

  // Every section's first data row (titleRow + 11) must reset Urut back to 1
  for (const tRow of titleRows) {
    assert.equal(
      ws.getCell(`A${tRow + 11}`).value,
      1,
      `Section starting at row ${tRow} must reset Urut to 1`
    );
  }

  // Logo anchored once per room section, all pointing to the same single embedded media ID
  const images = ws.getImages();
  assert.equal(images.length, occupiedRooms.length);
  const uniqueImageIds = new Set(images.map((img) => img.imageId));
  assert.equal(
    uniqueImageIds.size,
    1,
    'All room logos must reuse 1 single workbook media asset to keep Excel lightweight'
  );

  // Verify genuine OOXML <rowBreaks> & single media asset inside the .xlsx ZIP archive
  const { inflateRawSync } = await import('node:zlib');
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = new Map<string, Uint8Array>();

  // Locate End of Central Directory (PK\x05\x06)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert.ok(eocdOffset >= 0, 'Valid ZIP EOCD header must exist');
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdCount = view.getUint16(eocdOffset + 10, true);
  let pos = cdOffset;
  const decoder = new TextDecoder();

  for (let i = 0; i < cdCount; i++) {
    assert.equal(view.getUint32(pos, true), 0x02014b50);
    const method = view.getUint16(pos + 10, true);
    const compSize = view.getUint32(pos + 20, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));

    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const rawData = bytes.subarray(dataStart, dataStart + compSize);
    entries.set(name, method === 8 ? inflateRawSync(rawData) : rawData);

    pos += 46 + nameLen + extraLen + commentLen;
  }

  // Confirm only 1 physical image file stored in xl/media/ (lightweight even for 100+ rooms)
  const mediaFiles = Array.from(entries.keys()).filter(
    (k) => k.startsWith('xl/media/') && !k.endsWith('/')
  );
  assert.equal(
    mediaFiles.length,
    1,
    'Only 1 physical logo image file may be stored in xl/media/ regardless of room count'
  );

  // Confirm exact OOXML <rowBreaks> tags match titleRows[1..N-1] - 1
  const sheetXml = decoder.decode(entries.get('xl/worksheets/sheet1.xml')!);
  const rowBreaksMatch = sheetXml.match(/<rowBreaks[^>]*>([\s\S]*?)<\/rowBreaks>/);
  assert.ok(rowBreaksMatch, 'OOXML <rowBreaks> element must be present in sheet1.xml');
  const breakIds = Array.from(rowBreaksMatch[1].matchAll(/<brk[^>]*id="(\d+)"/g)).map(
    (m) => Number(m[1])
  );
  assert.equal(
    breakIds.length,
    occupiedRooms.length - 1,
    'Must insert exactly N-1 horizontal Excel page breaks between rooms'
  );
  for (let i = 1; i < titleRows.length; i++) {
    assert.equal(breakIds[i - 1], titleRows[i] - 1);
  }
});

