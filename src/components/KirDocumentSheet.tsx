import React, { useEffect, useState } from 'react';
import { InstansiSetting } from '../types/kir';
import { KirRoomSection } from '../utils/kirLogic';
import { computeKirPrintPageMeta } from '../utils/kirExcelExport';
import { paginateItems } from '../utils/tablePagination';
import { TablePagination } from './TablePagination';

interface KirDocumentSheetProps {
  section: KirRoomSection;
  instansi: InstansiSetting;
  tanggalCetak: string;
  /** True for rooms 2..N in multi-room split mode so browser Print starts a fresh page */
  pageBreakBefore?: boolean;
  /** Optional 1-based sheet index & total sheet count shown only in screen helper header */
  sheetIndex?: number;
  totalSheets?: number;
}

export const KirDocumentSheet: React.FC<KirDocumentSheetProps> = ({
  section,
  instansi,
  tanggalCetak,
  pageBreakBefore = false,
  sheetIndex,
  totalSheets,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [section.sectionKey, section.rows.length]);

  const pagination = paginateItems(section.rows, currentPage, pageSize);
  const printPageMeta = computeKirPrintPageMeta(section.rows.length);

  const pjNama = section.penanggungJawab || instansi.namaKepalaUnit;
  const pjNip = section.nipPenanggungJawab || instansi.nipKepalaUnit;

  const isBatchSheet =
    typeof sheetIndex === 'number' &&
    typeof totalSheets === 'number' &&
    totalSheets > 1;

  return (
    <div
      id={`kir-sheet-${section.sectionKey}`}
      data-testid="kir-document-sheet"
      data-room-id={section.ruangan?.id ?? section.sectionKey}
      className={`space-y-2 ${pageBreakBefore ? 'print-page-break' : ''}`}
    >
      {/* Screen-only page separator banner when previewing multiple separated rooms */}
      {isBatchSheet && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-stone-100 border border-stone-200 rounded-md text-xs text-stone-700 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-[#0F5C4D]">
              Lembar {sheetIndex} / {totalSheets}
            </span>
            <span className="text-stone-400">·</span>
            <span className="font-semibold text-stone-900 uppercase">
              {section.namaRuangan}
              {section.ruangan?.subRuangan
                ? ` — ${section.ruangan.subRuangan}`
                : ''}
            </span>
            {section.kodeRuangan && (
              <span className="font-mono text-[11px] text-stone-500">
                [{section.kodeRuangan}]
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-stone-600">
            {section.rows.length} jenis · {section.totalUnits} unit ·{' '}
            {pageBreakBefore ? 'Mulai halaman baru saat cetak' : 'Halaman pertama'}
          </div>
        </div>
      )}

      {/* Official KIR Document Sheet */}
      <div className="bg-white border border-stone-300 rounded-lg p-6 sm:p-8 space-y-4 print-sheet">
        {/* Top Title */}
        <div className="text-center">
          <h2 className="text-sm sm:text-base font-bold tracking-wide text-stone-900 uppercase">
            KARTU INVENTARIS RUANGAN
          </h2>
        </div>

        {/* Kop Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-2 text-xs text-stone-900">
          {/* Left Side */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-20 shrink-0 flex items-center justify-center">
              {instansi.logoUrl ? (
                <img
                  src={instansi.logoUrl}
                  alt="Logo Kop Instansi"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <svg
                  viewBox="0 0 100 120"
                  className="w-16 h-20"
                  aria-label="Lambang Daerah"
                >
                  <path
                    d="M50 6 L90 22 L86 72 C84 95 50 112 50 112 C50 112 16 95 14 72 L10 22 Z"
                    fill="#e0f2fe"
                    stroke="#1e3a8a"
                    strokeWidth="4"
                  />
                  <path
                    d="M50 14 L82 27 L79 70 C77 88 50 103 50 103 C50 103 23 88 21 70 L18 27 Z"
                    fill="#1d4ed8"
                  />
                  <polygon
                    points="50,26 55,39 69,39 58,47 62,60 50,52 38,60 42,47 31,39 45,39"
                    fill="#facc15"
                  />
                  <rect
                    x="30"
                    y="68"
                    width="40"
                    height="10"
                    rx="2"
                    fill="#ffffff"
                  />
                  <path
                    d="M22 106 Q50 116 78 106"
                    fill="none"
                    stroke="#b45309"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>

            <table className="text-xs border-collapse">
              <tbody>
                <tr>
                  <td className="py-0.5 pr-2 font-semibold text-right whitespace-nowrap">
                    PROPINSI
                  </td>
                  <td className="py-0.5 px-1 font-semibold">:</td>
                  <td className="py-0.5 font-medium uppercase">
                    {instansi.propinsi}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-2 font-semibold text-right whitespace-nowrap">
                    KOTA/KAB
                  </td>
                  <td className="py-0.5 px-1 font-semibold">:</td>
                  <td className="py-0.5 font-medium uppercase">
                    {instansi.kotaKab}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-2 font-semibold text-right whitespace-nowrap">
                    UNIT
                  </td>
                  <td className="py-0.5 px-1 font-semibold">:</td>
                  <td className="py-0.5 font-medium uppercase">
                    {instansi.unit}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-2 font-semibold text-right whitespace-nowrap">
                    SATUAN KERJA
                  </td>
                  <td className="py-0.5 px-1 font-semibold">:</td>
                  <td className="py-0.5 font-medium uppercase">
                    {instansi.satuanKerja}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right Side */}
          <div className="lg:text-right">
            <table className="text-xs border-collapse lg:ml-auto">
              <tbody>
                <tr>
                  <td className="py-0.5 pr-2 font-semibold text-right whitespace-nowrap">
                    NO. KODE LOKASI
                  </td>
                  <td className="py-0.5 px-1 font-semibold">:</td>
                  <td className="py-0.5 font-mono font-semibold text-left">
                    {instansi.kodeLokasi}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-2 font-semibold text-right whitespace-nowrap">
                    NAMA RUANGAN
                  </td>
                  <td className="py-0.5 px-1 font-semibold">:</td>
                  <td className="py-0.5 font-semibold text-left uppercase">
                    {section.namaRuangan}
                  </td>
                </tr>
                {section.subRuanganLabel && (
                  <tr>
                    <td className="py-0.5 pr-2"></td>
                    <td className="py-0.5 px-1"></td>
                    <td className="py-0.5 font-semibold text-left uppercase">
                      {section.subRuanganLabel}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="py-0.5 pr-2 font-medium text-right whitespace-nowrap">
                    Tahun data pelaporan
                  </td>
                  <td className="py-0.5 px-1">:</td>
                  <td className="py-0.5 font-medium text-left">
                    {instansi.tahunPelaporan}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-2 font-medium text-right whitespace-nowrap">
                    Halaman
                  </td>
                  <td className="py-0.5 px-1">:</td>
                  <td
                    className="py-0.5 font-mono text-left"
                    data-testid="kir-kop-halaman"
                  >
                    <span className="print:hidden">
                      {pagination.safePage} dari {pagination.totalPages}
                    </span>
                    <span className="hidden print:inline">
                      {printPageMeta.kopLabel}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Exact 13-Column Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border-2 border-slate-900 text-[11px]">
            <thead>
              <tr className="bg-stone-50 text-stone-900 font-bold text-center">
                <th
                  rowSpan={2}
                  className="border border-slate-900 py-2 px-1.5 w-10"
                >
                  Urut
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2.5">
                  Jenis barang/
                  <br />
                  Nama barang
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2">
                  Merk/
                  <br />
                  Model
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2">
                  No.Seri Pabrik
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2">
                  Ukuran
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2">
                  Bahan
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2">
                  Tahun
                  <br />
                  Pembuatan
                  <br />
                  /Pembelian
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2.5">
                  No.
                  <br />
                  Kode barang
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2">
                  Jumlah
                  <br />
                  Barang
                </th>
                <th colSpan={3} className="border border-slate-900 py-1.5 px-2">
                  Keadaan Barang
                </th>
                <th rowSpan={2} className="border border-slate-900 py-2 px-2.5">
                  Keterangan
                </th>
              </tr>
              <tr className="bg-stone-50 text-stone-900 font-bold text-center">
                <th className="border border-slate-900 py-1 px-2 w-12">Baik</th>
                <th className="border border-slate-900 py-1 px-2 w-14">
                  Kurang
                  <br />
                  Baik
                </th>
                <th className="border border-slate-900 py-1 px-2 w-14">
                  Rusak
                  <br />
                  Berat
                </th>
              </tr>
              <tr className="bg-stone-100/80 text-stone-900 font-bold italic text-center text-[10px]">
                <th className="border border-slate-900 py-1 px-1">1</th>
                <th className="border border-slate-900 py-1 px-1">2</th>
                <th className="border border-slate-900 py-1 px-1">3</th>
                <th className="border border-slate-900 py-1 px-1">4</th>
                <th className="border border-slate-900 py-1 px-1">5</th>
                <th className="border border-slate-900 py-1 px-1">6</th>
                <th className="border border-slate-900 py-1 px-1">7</th>
                <th className="border border-slate-900 py-1 px-1">8</th>
                <th className="border border-slate-900 py-1 px-1">9</th>
                <th className="border border-slate-900 py-1 px-1">10</th>
                <th className="border border-slate-900 py-1 px-1">11</th>
                <th className="border border-slate-900 py-1 px-1">12</th>
                <th className="border border-slate-900 py-1 px-1">13</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="border border-slate-900 py-8 text-center text-stone-500"
                  >
                    Tidak ada data inventaris barang pada sub-ruangan/kriteria ini.
                  </td>
                </tr>
              ) : (
                section.rows.map((row, idx) => {
                  const isVisibleOnScreen =
                    idx >= pagination.startIndex && idx < pagination.endIndex;
                  return (
                    <tr
                      key={row.rowKey}
                      className={`text-stone-900 ${
                        isVisibleOnScreen ? '' : 'hidden print:table-row'
                      }`}
                    >
                      <td className="border border-slate-900 py-2 px-1.5 text-center font-mono tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 font-medium uppercase">
                        {row.namaBarang}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center uppercase">
                        {row.merkTipe}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center font-mono">
                        {row.nomorSeri}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center font-mono uppercase">
                        {row.ukuran}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center uppercase">
                        {row.bahan}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                        {row.tahunPerolehan}
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 text-center font-mono">
                        {row.kodeBarang}
                      </td>
                      <td className="border border-slate-900 py-1.5 px-2 text-center font-mono tabular-nums leading-tight">
                        <div className="font-semibold">{row.jumlah}</div>
                        <div className="text-[10px] uppercase">
                          {row.satuan}
                        </div>
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                        {row.baik}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                        {row.kurangBaik}
                      </td>
                      <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                        {row.rusakBerat}
                      </td>
                      <td className="border border-slate-900 py-2 px-2.5 text-center break-all max-w-[180px]">
                        {row.locationLabel ? (
                          <span>
                            <strong>[{row.locationLabel}]</strong>{' '}
                            {row.keterangan}
                          </span>
                        ) : (
                          row.keterangan
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50 font-bold text-stone-900">
                <td
                  colSpan={8}
                  className="border border-slate-900 py-2 px-3 text-right"
                >
                  JUMLAH TOTAL
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {section.totalUnits} UNIT
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {section.countBaik}
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {section.countKurangBaik}
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {section.countRusakBerat}
                </td>
                <td className="border border-slate-900 py-2 px-2.5 text-center">
                  {section.rows.length} Jenis
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Screen-only pagination (Print & Excel always include 100% of rows) */}
        {section.rows.length > 0 && (!isBatchSheet || section.rows.length > pageSize) && (
          <div className="border border-stone-200 rounded-md overflow-hidden no-print">
            <TablePagination
              compact
              currentPage={pagination.safePage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              startDisplay={pagination.startDisplay}
              endDisplay={pagination.endDisplay}
              pageSize={pagination.pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="baris KIR"
              helperNote="Cetak & Excel tetap menyertakan seluruh baris KIR."
              className="border-t-0"
            />
          </div>
        )}

        {/* Kolom Tanda Tangan Pengesahan 3 Pejabat */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 text-xs text-center text-stone-800 break-inside-avoid">
          <div className="space-y-14">
            <div>
              <div className="text-stone-500">Mengetahui,</div>
              <div className="font-semibold">Direktur</div>
            </div>
            <div>
              <div className="font-bold underline text-stone-900">
                {instansi.namaKepalaUnit}
              </div>
              <div className="font-mono text-[11px] text-stone-600">
                NIP. {instansi.nipKepalaUnit}
              </div>
            </div>
          </div>

          <div className="space-y-14">
            <div>
              <div className="text-stone-500">&nbsp;</div>
              <div className="font-semibold">Penanggung Jawab Ruangan</div>
            </div>
            <div>
              <div
                className="font-bold underline text-stone-900"
                data-testid="kir-signature-pj"
              >
                {pjNama}
              </div>
              <div className="font-mono text-[11px] text-stone-600">
                NIP. {pjNip}
              </div>
            </div>
          </div>

          <div className="space-y-14">
            <div>
              <div className="text-stone-500">
                {instansi.kotaKab}, {tanggalCetak}
              </div>
              <div className="font-semibold">Pengurus Barang</div>
            </div>
            <div>
              <div className="font-bold underline text-stone-900">
                {instansi.namaPengurusBarang}
              </div>
              <div className="font-mono text-[11px] text-stone-600">
                NIP. {instansi.nipPengurusBarang}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
