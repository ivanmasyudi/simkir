import ExcelJS from 'exceljs';
import { Barang, InstansiSetting, Ruangan } from '../types/kir';
import {
  buildKirRoomSections,
  consolidateKirReportRows,
  getSubRuanganByParent,
  KirRoomSection,
} from './kirLogic';

export interface KirExcelExportOptions {
  startUrut?: number;
  tanggalCetak?: string;
  parentRuanganName?: string;
  ruanganList?: Ruangan[];
  consolidateSameItems?: boolean;
  /** When true (and ruangan is undefined), separates each sub-ruangan with native horizontal page breaks on 1 sheet */
  splitByRoom?: boolean;
  /** When splitByRoom is true, whether to include rooms that have 0 items (default false) */
  includeEmptyRooms?: boolean;
  /** Optional pre-built sections (takes precedence over splitByRoom computation) */
  sections?: KirRoomSection[];
  /** Pre-rendered PNG or JPEG base64 (with or without data URL prefix) for the Kop logo */
  logoBase64?: string;
  logoExtension?: 'png' | 'jpeg';
}

export interface KirPrintPageMeta {
  totalPrintPages: number;
  kopLabel: string;
}

export const DEFAULT_KIR_ROWS_PER_PRINT_PAGE = 20;

/**
 * Computes automatic KIR print page count and Kop Kanan "Halaman" label
 * based on total consolidated rows (1 page -> "1", multi-page -> "1 s.d N").
 */
export function computeKirPrintPageMeta(
  totalRows: number,
  rowsPerPrintPage = DEFAULT_KIR_ROWS_PER_PRINT_PAGE
): KirPrintPageMeta {
  const safePerPage = Math.max(1, Math.floor(rowsPerPrintPage));
  const safeRows = Math.max(0, Math.floor(totalRows));
  const totalPrintPages = Math.max(1, Math.ceil(safeRows / safePerPage));
  const kopLabel = totalPrintPages <= 1 ? '1' : `1 s.d ${totalPrintPages}`;
  return { totalPrintPages, kopLabel };
}

export const DEFAULT_KIR_EMBLEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" width="200" height="240">
  <path d="M50 6 L90 22 L86 72 C84 95 50 112 50 112 C50 112 16 95 14 72 L10 22 Z" fill="#e0f2fe" stroke="#1e3a8a" stroke-width="4" />
  <path d="M50 14 L82 27 L79 70 C77 88 50 103 50 103 C50 103 23 88 21 70 L18 27 Z" fill="#1d4ed8" />
  <polygon points="50,26 55,39 69,39 58,47 62,60 50,52 38,60 42,47 31,39 45,39" fill="#facc15" />
  <rect x="30" y="68" width="40" height="10" rx="2" fill="#ffffff" />
  <path d="M22 106 Q50 116 78 106" fill="none" stroke="#b45309" stroke-width="5" stroke-linecap="round" />
</svg>`;

/**
 * Browser helper: rasterizes either a user-uploaded logo data URL (PNG/JPG/WebP/SVG)
 * or the default Lambang Daerah SVG emblem into a crisp PNG base64 string for ExcelJS.
 */
export async function resolveLogoPngBase64InBrowser(
  logoUrl?: string
): Promise<{ base64: string; extension: 'png' | 'jpeg' } | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const renderSrcToPng = (src: string): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const targetW = 192;
          const targetH = 240;
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.clearRect(0, 0, targetW, targetH);
          const scale = Math.min(
            targetW / (img.naturalWidth || targetW),
            targetH / (img.naturalHeight || targetH)
          );
          const drawW = (img.naturalWidth || targetW) * scale;
          const drawH = (img.naturalHeight || targetH) * scale;
          const dx = (targetW - drawW) / 2;
          const dy = (targetH - drawH) / 2;
          ctx.drawImage(img, dx, dy, drawW, drawH);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });

  if (logoUrl && logoUrl.trim()) {
    const trimmed = logoUrl.trim();
    const rasterized = await renderSrcToPng(trimmed);
    if (rasterized) {
      return { base64: rasterized, extension: 'png' };
    }
    // Fallback if canvas taint prevented toDataURL on an already-valid PNG/JPEG data URL
    if (/^data:image\/png;base64,/i.test(trimmed)) {
      return { base64: trimmed, extension: 'png' };
    }
    if (/^data:image\/jpe?g;base64,/i.test(trimmed)) {
      return { base64: trimmed, extension: 'jpeg' };
    }
  }

  // Default Lambang Daerah emblem matching LaporanKirView preview
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    DEFAULT_KIR_EMBLEM_SVG
  )}`;
  const emblemPng = await renderSrcToPng(svgDataUrl);
  if (emblemPng) {
    return { base64: emblemPng, extension: 'png' };
  }
  return null;
}

const THIN_BLACK: Partial<ExcelJS.Border> = {
  style: 'thin',
  color: { argb: 'FF0F172A' },
};

const MEDIUM_BLACK: Partial<ExcelJS.Border> = {
  style: 'medium',
  color: { argb: 'FF0F172A' },
};

/**
 * Writes a complete official 13-column KIR block (Title, Logo, Kop Kiri & Kanan,
 * 13-column table, JUMLAH TOTAL, and 3-pejabat signature block) starting at
 * `startRow` on `sheet`, returning the last written row number (sigNipRow).
 */
function writeKirSectionToSheet(
  sheet: ExcelJS.Worksheet,
  section: KirRoomSection,
  instansi: InstansiSetting,
  params: {
    startRow: number;
    startUrut: number;
    tanggalCetak: string;
    logoImageId?: number;
  }
): number {
  const { startRow, startUrut, tanggalCetak, logoImageId } = params;
  const printPageMeta = computeKirPrintPageMeta(section.rows.length);

  // Offset 0: Document Title
  const titleRow = startRow;
  sheet.mergeCells(`A${titleRow}:M${titleRow}`);
  const titleCell = sheet.getCell(`A${titleRow}`);
  titleCell.value = 'KARTU INVENTARIS RUANGAN';
  titleCell.font = {
    name: 'Arial',
    size: 13,
    bold: true,
    color: { argb: 'FF0F172A' },
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(titleRow).height = 24;

  // Offset 1: Spacer
  const spacerTopRow = startRow + 1;
  sheet.getRow(spacerTopRow).height = 6;

  // Reuse single workbook logo image across all sections (keeps .xlsx lightweight)
  if (typeof logoImageId === 'number') {
    sheet.addImage(logoImageId, {
      tl: { col: 0.75, row: startRow - 1 + 2.1 },
      ext: { width: 64, height: 80 },
    });
  }

  // Offset 2..6: Kop Kiri & Kop Kanan
  const kopRows: Array<{
    row: number;
    leftLabel: string;
    leftValue: string;
    rightLabel: string;
    rightValue: string;
    rightLabelBold?: boolean;
    rightValueBold?: boolean;
    rightValueAsText?: boolean;
  }> = [
    {
      row: startRow + 2,
      leftLabel: 'PROPINSI',
      leftValue: `: ${(instansi.propinsi || '').toUpperCase()}`,
      rightLabel: 'NO. KODE LOKASI',
      rightValue: `: ${instansi.kodeLokasi || ''}`,
      rightLabelBold: true,
      rightValueBold: true,
      rightValueAsText: true,
    },
    {
      row: startRow + 3,
      leftLabel: 'KOTA/KAB',
      leftValue: `: ${(instansi.kotaKab || '').toUpperCase()}`,
      rightLabel: 'NAMA RUANGAN',
      rightValue: `: ${section.namaRuangan.toUpperCase()}`,
      rightLabelBold: true,
      rightValueBold: true,
    },
    {
      row: startRow + 4,
      leftLabel: 'UNIT',
      leftValue: `: ${(instansi.unit || '').toUpperCase()}`,
      rightLabel: '',
      rightValue: section.subRuanganLabel
        ? `  ${section.subRuanganLabel.toUpperCase()}`
        : '',
      rightLabelBold: false,
      rightValueBold: true,
    },
    {
      row: startRow + 5,
      leftLabel: 'SATUAN KERJA',
      leftValue: `: ${(instansi.satuanKerja || '').toUpperCase()}`,
      rightLabel: 'Tahun data pelaporan',
      rightValue: `: ${instansi.tahunPelaporan || ''}`,
      rightLabelBold: false,
      rightValueBold: false,
    },
    {
      row: startRow + 6,
      leftLabel: '',
      leftValue: '',
      rightLabel: 'Halaman',
      rightValue: `: ${printPageMeta.kopLabel}`,
      rightLabelBold: false,
      rightValueBold: false,
    },
  ];

  for (const kr of kopRows) {
    sheet.getRow(kr.row).height = 18;
    sheet.mergeCells(`C${kr.row}:G${kr.row}`);
    sheet.mergeCells(`H${kr.row}:I${kr.row}`);
    sheet.mergeCells(`J${kr.row}:M${kr.row}`);

    const leftLabelCell = sheet.getCell(`B${kr.row}`);
    leftLabelCell.value = kr.leftLabel;
    leftLabelCell.font = {
      name: 'Arial',
      size: 9,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    leftLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const leftValCell = sheet.getCell(`C${kr.row}`);
    leftValCell.value = kr.leftValue;
    leftValCell.font = {
      name: 'Arial',
      size: 9,
      bold: false,
      color: { argb: 'FF0F172A' },
    };
    leftValCell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true,
    };

    const rightLabelCell = sheet.getCell(`H${kr.row}`);
    rightLabelCell.value = kr.rightLabel;
    rightLabelCell.font = {
      name: 'Arial',
      size: 9,
      bold: Boolean(kr.rightLabelBold),
      color: { argb: 'FF0F172A' },
    };
    rightLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const rightValCell = sheet.getCell(`J${kr.row}`);
    rightValCell.value = kr.rightValue;
    rightValCell.font = {
      name: 'Arial',
      size: 9,
      bold: Boolean(kr.rightValueBold),
      color: { argb: 'FF0F172A' },
    };
    rightValCell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true,
    };
    if (kr.rightValueAsText) {
      rightValCell.numFmt = '@';
    }
  }

  // Offset 7: Spacer before table
  const spacerBeforeTableRow = startRow + 7;
  sheet.getRow(spacerBeforeTableRow).height = 8;

  // Offset 8..10: Exact 13-column Table Headers
  const headerTopRow = startRow + 8;
  const headerSubRow = startRow + 9;
  const headerNumRow = startRow + 10;

  sheet.getRow(headerTopRow).height = 24;
  sheet.getRow(headerSubRow).height = 24;
  sheet.getRow(headerNumRow).height = 17;

  const verticalHeaderMerges: Array<[string, string]> = [
    ['A', 'Urut'],
    ['B', 'Jenis barang/\nNama barang'],
    ['C', 'Merk/\nModel'],
    ['D', 'No.Seri Pabrik'],
    ['E', 'Ukuran'],
    ['F', 'Bahan'],
    ['G', 'Tahun\nPembuatan\n/Pembelian'],
    ['H', 'No.\nKode barang'],
    ['I', 'Jumlah\nBarang'],
    ['M', 'Keterangan'],
  ];

  for (const [col, text] of verticalHeaderMerges) {
    sheet.mergeCells(`${col}${headerTopRow}:${col}${headerSubRow}`);
    sheet.getCell(`${col}${headerTopRow}`).value = text;
  }

  sheet.mergeCells(`J${headerTopRow}:L${headerTopRow}`);
  sheet.getCell(`J${headerTopRow}`).value = 'Keadaan Barang';
  sheet.getCell(`J${headerSubRow}`).value = 'Baik';
  sheet.getCell(`K${headerSubRow}`).value = 'Kurang\nBaik';
  sheet.getCell(`L${headerSubRow}`).value = 'Rusak\nBerat';

  for (let c = 1; c <= 13; c++) {
    sheet.getCell(headerNumRow, c).value = c;
  }

  // Style Header Rows
  for (const r of [headerTopRow, headerSubRow]) {
    for (let c = 1; c <= 13; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = {
        name: 'Arial',
        size: 9,
        bold: true,
        color: { argb: 'FF0F172A' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFAFAF9' },
      };
      cell.border = {
        top: r === headerTopRow ? MEDIUM_BLACK : THIN_BLACK,
        bottom: THIN_BLACK,
        left: c === 1 ? MEDIUM_BLACK : THIN_BLACK,
        right: c === 13 ? MEDIUM_BLACK : THIN_BLACK,
      };
    }
  }

  // Style Column Number Row (1..13)
  for (let c = 1; c <= 13; c++) {
    const cell = sheet.getCell(headerNumRow, c);
    cell.font = {
      name: 'Arial',
      size: 8.5,
      bold: true,
      italic: true,
      color: { argb: 'FF0F172A' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F5F4' },
    };
    cell.border = {
      top: THIN_BLACK,
      bottom: THIN_BLACK,
      left: c === 1 ? MEDIUM_BLACK : THIN_BLACK,
      right: c === 13 ? MEDIUM_BLACK : THIN_BLACK,
    };
  }

  // Data Rows
  let totalUnit = 0;
  let totalBaik = 0;
  let totalKurangBaik = 0;
  let totalRusakBerat = 0;
  let currentRow = headerNumRow + 1;

  if (section.rows.length === 0) {
    sheet.mergeCells(`A${currentRow}:M${currentRow}`);
    const emptyCell = sheet.getCell(`A${currentRow}`);
    emptyCell.value =
      'Tidak ada data inventaris barang pada sub-ruangan/kriteria ini.';
    emptyCell.font = {
      name: 'Arial',
      size: 9,
      italic: true,
      color: { argb: 'FF64748B' },
    };
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(currentRow).height = 28;
    for (let c = 1; c <= 13; c++) {
      sheet.getCell(currentRow, c).border = {
        top: THIN_BLACK,
        bottom: THIN_BLACK,
        left: c === 1 ? MEDIUM_BLACK : THIN_BLACK,
        right: c === 13 ? MEDIUM_BLACK : THIN_BLACK,
      };
    }
    currentRow += 1;
  } else {
    section.rows.forEach((row, idx) => {
      totalUnit += row.jumlah;
      totalBaik += row.baik;
      totalKurangBaik += row.kurangBaik;
      totalRusakBerat += row.rusakBerat;

      const ketText = row.locationLabel
        ? `[${row.locationLabel}] ${row.keterangan}`.trim()
        : row.keterangan || '';

      const values: Array<string | number> = [
        startUrut + idx,
        (row.namaBarang || '').toUpperCase(),
        (row.merkTipe || '').toUpperCase(),
        row.nomorSeri || '',
        (row.ukuran || '').toUpperCase(),
        (row.bahan || '').toUpperCase(),
        row.tahunPerolehan,
        row.kodeBarang || '',
        `${row.jumlah}\n${(row.satuan || 'UNIT').toUpperCase()}`,
        row.baik,
        row.kurangBaik,
        row.rusakBerat,
        ketText,
      ];

      const excelRow = sheet.getRow(currentRow);
      excelRow.values = values;

      const longestKetLines = Math.max(1, Math.ceil(ketText.length / 24));
      const longestNamaLines = Math.max(
        1,
        Math.ceil((row.namaBarang || '').length / 26)
      );
      excelRow.height = Math.max(
        26,
        Math.max(longestKetLines, longestNamaLines, 2) * 14
      );

      for (let c = 1; c <= 13; c++) {
        const cell = sheet.getCell(currentRow, c);
        cell.font = {
          name: 'Arial',
          size: 9,
          bold: c === 2,
          color: { argb: 'FF0F172A' },
        };
        cell.alignment = {
          horizontal: c === 2 ? 'left' : 'center',
          vertical: 'middle',
          wrapText: true,
        };
        if (c === 4 || c === 8) {
          cell.numFmt = '@';
        }
        cell.border = {
          top: THIN_BLACK,
          bottom: THIN_BLACK,
          left: c === 1 ? MEDIUM_BLACK : THIN_BLACK,
          right: c === 13 ? MEDIUM_BLACK : THIN_BLACK,
        };
      }

      currentRow += 1;
    });
  }

  // Totals Row (JUMLAH TOTAL)
  const totalRow = currentRow;
  sheet.mergeCells(`A${totalRow}:H${totalRow}`);
  sheet.getCell(`A${totalRow}`).value = 'JUMLAH TOTAL';
  sheet.getCell(`I${totalRow}`).value = `${totalUnit} UNIT`;
  sheet.getCell(`J${totalRow}`).value = totalBaik;
  sheet.getCell(`K${totalRow}`).value = totalKurangBaik;
  sheet.getCell(`L${totalRow}`).value = totalRusakBerat;
  sheet.getCell(`M${totalRow}`).value = `${section.rows.length} Jenis`;
  sheet.getRow(totalRow).height = 22;

  for (let c = 1; c <= 13; c++) {
    const cell = sheet.getCell(totalRow, c);
    cell.font = {
      name: 'Arial',
      size: 9,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    cell.alignment = {
      horizontal: c <= 8 ? 'right' : 'center',
      vertical: 'middle',
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFAFAF9' },
    };
    cell.border = {
      top: THIN_BLACK,
      bottom: MEDIUM_BLACK,
      left: c === 1 ? MEDIUM_BLACK : THIN_BLACK,
      right: c === 13 ? MEDIUM_BLACK : THIN_BLACK,
    };
  }

  // Blank spacer row before signatures
  const spacerSigRow = totalRow + 1;
  sheet.getRow(spacerSigRow).height = 18;

  // 3-Pejabat Signature Block (Direktur | Penanggung Jawab Ruangan | Pengurus Barang)
  const sigTopRow = spacerSigRow + 1;
  const sigRoleRow = sigTopRow + 1;
  const sigGapStart = sigRoleRow + 1;
  const sigNameRow = sigGapStart + 3;
  const sigNipRow = sigNameRow + 1;

  const pjNama = section.penanggungJawab || instansi.namaKepalaUnit;
  const pjNip = section.nipPenanggungJawab || instansi.nipKepalaUnit;

  const signatureBlocks: Array<{
    range: [string, string];
    topText: string;
    roleText: string;
    nameText: string;
    nipText: string;
  }> = [
    {
      range: ['A', 'D'],
      topText: 'Mengetahui,',
      roleText: 'Direktur',
      nameText: instansi.namaKepalaUnit || '',
      nipText: `NIP. ${instansi.nipKepalaUnit || ''}`,
    },
    {
      range: ['E', 'I'],
      topText: '',
      roleText: 'Penanggung Jawab Ruangan',
      nameText: pjNama || '',
      nipText: `NIP. ${pjNip || ''}`,
    },
    {
      range: ['J', 'M'],
      topText: `${instansi.kotaKab || ''}, ${tanggalCetak}`,
      roleText: 'Pengurus Barang',
      nameText: instansi.namaPengurusBarang || '',
      nipText: `NIP. ${instansi.nipPengurusBarang || ''}`,
    },
  ];

  sheet.getRow(sigTopRow).height = 17;
  sheet.getRow(sigRoleRow).height = 17;
  sheet.getRow(sigGapStart).height = 18;
  sheet.getRow(sigGapStart + 1).height = 18;
  sheet.getRow(sigGapStart + 2).height = 18;
  sheet.getRow(sigNameRow).height = 18;
  sheet.getRow(sigNipRow).height = 17;

  for (const blk of signatureBlocks) {
    const [startCol, endCol] = blk.range;

    sheet.mergeCells(`${startCol}${sigTopRow}:${endCol}${sigTopRow}`);
    const topCell = sheet.getCell(`${startCol}${sigTopRow}`);
    topCell.value = blk.topText;
    topCell.font = { name: 'Arial', size: 9, color: { argb: 'FF475569' } };
    topCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${startCol}${sigRoleRow}:${endCol}${sigRoleRow}`);
    const roleCell = sheet.getCell(`${startCol}${sigRoleRow}`);
    roleCell.value = blk.roleText;
    roleCell.font = {
      name: 'Arial',
      size: 9,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    roleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${startCol}${sigNameRow}:${endCol}${sigNameRow}`);
    const nameCell = sheet.getCell(`${startCol}${sigNameRow}`);
    nameCell.value = blk.nameText;
    nameCell.font = {
      name: 'Arial',
      size: 9,
      bold: true,
      underline: true,
      color: { argb: 'FF0F172A' },
    };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(`${startCol}${sigNipRow}:${endCol}${sigNipRow}`);
    const nipCell = sheet.getCell(`${startCol}${sigNipRow}`);
    nipCell.value = blk.nipText;
    nipCell.font = { name: 'Arial', size: 8.5, color: { argb: 'FF334155' } };
    nipCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  return sigNipRow;
}

/**
 * Generates a native .xlsx Workbook buffer matching the official 13-column KIR
 * print sheet (Logo, Kop Kiri, Kop Kanan, 13 columns, JUMLAH TOTAL, and
 * 3-pejabat signature block: Direktur, Penanggung Jawab Ruangan, Pengurus Barang).
 *
 * When multiple sub-ruangan sections are provided (or splitByRoom=true), all rooms
 * are rendered on a single lightweight worksheet with native horizontal Excel page
 * breaks between every sub-ruangan and a single reused logo asset.
 */
export async function buildKirExcelBuffer(
  barangList: Barang[],
  instansi: InstansiSetting,
  ruangan?: Ruangan,
  options?: KirExcelExportOptions
): Promise<ArrayBuffer> {
  const startUrut = options?.startUrut ?? 1;
  const tanggalCetak = options?.tanggalCetak ?? '21 November 2026';
  const ruanganList = options?.ruanganList ?? [];
  const parentName = options?.parentRuanganName;
  const consolidateSameItems = options?.consolidateSameItems ?? true;

  let sections: KirRoomSection[];
  if (options?.sections && options.sections.length > 0) {
    sections = options.sections;
  } else if (!ruangan && options?.splitByRoom && ruanganList.length > 0) {
    sections = buildKirRoomSections(barangList, ruanganList, {
      selectedParentName: parentName ?? 'ALL',
      selectedRuanganId: 'ALL',
      consolidateSameItems,
      splitByRoom: true,
      includeEmptyRooms: options.includeEmptyRooms ?? false,
      fallbackDirekturNama: instansi.namaKepalaUnit,
      fallbackDirekturNip: instansi.nipKepalaUnit,
    });
  } else {
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

    const fallbackPjRoom =
      ruangan ||
      (parentName && parentName !== 'ALL'
        ? getSubRuanganByParent(ruanganList, parentName)[0]
        : undefined);

    const reportRows = consolidateKirReportRows(barangList, {
      ruangan,
      ruanganList,
      consolidateSameItems,
    });

    sections = [
      {
        sectionKey: ruangan?.id ?? 'single-section',
        ruangan,
        namaRuangan: namaRuanganHeader,
        subRuanganLabel: subRuanganHeader,
        kodeRuangan: ruangan?.kodeRuangan ?? '',
        penanggungJawab: fallbackPjRoom
          ? fallbackPjRoom.penanggungJawab
          : instansi.namaKepalaUnit,
        nipPenanggungJawab: fallbackPjRoom
          ? fallbackPjRoom.nipPenanggungJawab
          : instansi.nipKepalaUnit,
        items: barangList,
        rows: reportRows,
        totalUnits: reportRows.reduce((acc, r) => acc + r.jumlah, 0),
        countBaik: reportRows.reduce((acc, r) => acc + r.baik, 0),
        countKurangBaik: reportRows.reduce((acc, r) => acc + r.kurangBaik, 0),
        countRusakBerat: reportRows.reduce((acc, r) => acc + r.rusakBerat, 0),
      },
    ];
  }

  // Ensure workbook always has at least 1 valid section even when all rooms are empty
  if (sections.length === 0) {
    sections = [
      {
        sectionKey: 'empty-fallback',
        ruangan: undefined,
        namaRuangan:
          parentName && parentName !== 'ALL' ? parentName : 'SELURUH RUANGAN',
        subRuanganLabel:
          parentName && parentName !== 'ALL'
            ? '( SEMUA SUB-RUANGAN )'
            : '( REKAPITULASI INVENTARIS )',
        kodeRuangan: '',
        penanggungJawab: instansi.namaKepalaUnit,
        nipPenanggungJawab: instansi.nipKepalaUnit,
        items: [],
        rows: [],
        totalUnits: 0,
        countBaik: 0,
        countKurangBaik: 0,
        countRusakBerat: 0,
      },
    ];
  }

  const isMultiSection = sections.length > 1;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMKIR';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('KARTU INVENTARIS RUANGAN', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      ...(isMultiSection ? {} : { printTitlesRow: '9:11' }),
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.45,
        bottom: 0.55,
        header: 0.2,
        footer: 0.25,
      },
    },
    headerFooter: {
      oddFooter: '&R Halaman &P dari &N',
    },
  });

  // 13 columns matching exact KIR specification
  sheet.columns = [
    { key: 'urut', width: 7 },    // A (1)
    { key: 'nama', width: 28 },   // B (2)
    { key: 'merk', width: 15 },   // C (3)
    { key: 'seri', width: 16 },   // D (4)
    { key: 'ukuran', width: 11 }, // E (5)
    { key: 'bahan', width: 12 },  // F (6)
    { key: 'tahun', width: 12 },  // G (7)
    { key: 'kode', width: 21 },   // H (8)
    { key: 'jumlah', width: 12 }, // I (9)
    { key: 'baik', width: 8 },    // J (10)
    { key: 'kb', width: 9 },      // K (11)
    { key: 'rb', width: 9 },      // L (12)
    { key: 'ket', width: 24 },    // M (13)
  ];

  // Register logo image ONCE in the workbook so multi-room export stays tiny & fast
  const resolvedLogoBase64 =
    options?.logoBase64 ||
    (instansi.logoUrl && /^data:image\/(png|jpe?g);base64,/i.test(instansi.logoUrl)
      ? instansi.logoUrl
      : undefined);

  let logoImageId: number | undefined;
  if (resolvedLogoBase64) {
    const extension: 'png' | 'jpeg' =
      options?.logoExtension ||
      (/^data:image\/jpe?g;base64,/i.test(resolvedLogoBase64) ? 'jpeg' : 'png');
    logoImageId = workbook.addImage({
      base64: resolvedLogoBase64,
      extension,
    });
  }

  let nextStartRow = 1;
  sections.forEach((section, idx) => {
    const lastRow = writeKirSectionToSheet(sheet, section, instansi, {
      startRow: nextStartRow,
      startUrut: idx === 0 ? startUrut : 1,
      tanggalCetak,
      logoImageId,
    });

    if (idx < sections.length - 1) {
      // Native Excel horizontal page break immediately after this room's signature block
      sheet.getRow(lastRow).addPageBreak();
      nextStartRow = lastRow + 1;
    }
  });

  return workbook.xlsx.writeBuffer();
}

