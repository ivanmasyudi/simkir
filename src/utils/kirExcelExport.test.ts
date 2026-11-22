import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  DEFAULT_INSTANSI_SETTING,
  INITIAL_BARANG_LIST,
  INITIAL_RUANGAN_LIST,
} from '../data/seedData';
import { buildKirExcelBuffer } from './kirExcelExport';

// 1x1 valid PNG pixel base64 for deterministic Node.js image embedding verification
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('buildKirExcelBuffer produces native .xlsx matching KIR preview: logo, Kop Kiri/Kanan, 13 columns, totals, and Direktur/PJ/Pengurus Barang signatures', async () => {
  const ruangan = INITIAL_RUANGAN_LIST[0]; // INST. LABORATORIUM -> R. PATOLOGI ANATOMI
  const items = INITIAL_BARANG_LIST.filter((b) => b.ruanganId === ruangan.id);

  const instansi = {
    ...DEFAULT_INSTANSI_SETTING,
    namaKepalaUnit: 'dr. H. Ahmad Direksi, Sp.PD',
    nipKepalaUnit: '197001012000031001',
    namaPengurusBarang: 'Budi Pengurus, S.E.',
    nipPengurusBarang: '199002022015031002',
    logoUrl: TINY_PNG_DATA_URL,
  };

  const buffer = await buildKirExcelBuffer(items, instansi, ruangan, {
    startUrut: 21,
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

  // 2. Title & Kop Kiri + Kop Kanan exact parity
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
  assert.equal(ws.getCell('J7').value, `: ${instansi.halaman}`);

  // 3. Exact 13-column headers + column numbering 1..13
  assert.equal(ws.getCell('A9').value, 'Urut');
  assert.equal(ws.getCell('J9').value, 'Keadaan Barang');
  assert.equal(ws.getCell('J10').value, 'Baik');
  assert.equal(ws.getCell('K10').value, 'Kurang\nBaik');
  assert.equal(ws.getCell('L10').value, 'Rusak\nBerat');
  for (let col = 1; col <= 13; col++) {
    assert.equal(ws.getCell(11, col).value, col);
  }

  // 4. First data row & Totals row parity (including Jenis count in col 13)
  assert.equal(ws.getCell('A12').value, 21);
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
      startUrut: 1,
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
