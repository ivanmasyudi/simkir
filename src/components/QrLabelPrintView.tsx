import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Printer,
  QrCode,
  Search,
  Square,
} from 'lucide-react';
import { Barang, InstansiSetting, Ruangan } from '../types/kir';
import {
  buildQrPayload,
  formatRuanganFullLabel,
  getSubRuanganByParent,
  getUniqueParentRuanganNames,
  resolveBarangRoom,
} from '../utils/kirLogic';
import { QrCodeSvg } from './QrCodeSvg';
import { TablePagination } from './TablePagination';
import { paginateItems } from '../utils/tablePagination';

interface QrLabelPrintViewProps {
  barangList: Barang[];
  ruanganList: Ruangan[];
  instansi: InstansiSetting;
  initialFilterRuanganId?: string;
}

type LabelSize = 'compact' | 'standard' | 'large';

export const QrLabelPrintView: React.FC<QrLabelPrintViewProps> = ({
  barangList,
  ruanganList,
  instansi,
  initialFilterRuanganId = 'ALL',
}) => {
  const [filterParent, setFilterParent] = useState('ALL');
  const [filterRuangan, setFilterRuangan] = useState(initialFilterRuanganId);
  const [search, setSearch] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const [showRuangan, setShowRuangan] = useState(true);
  const [showUkuranBahan, setShowUkuranBahan] = useState(true);
  const [expandPerUnit, setExpandPerUnit] = useState(false);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerPageSize, setPickerPageSize] = useState(10);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(12);

  const parentNames = getUniqueParentRuanganNames(ruanganList);
  const subOptions =
    filterParent === 'ALL'
      ? ruanganList
      : getSubRuanganByParent(ruanganList, filterParent);

  useEffect(() => {
    if (initialFilterRuanganId && initialFilterRuanganId !== 'ALL') {
      const target = ruanganList.find((r) => r.id === initialFilterRuanganId);
      if (target) {
        setFilterParent(target.namaRuangan);
        setFilterRuangan(target.id);
      } else {
        setFilterParent('ALL');
        setFilterRuangan('ALL');
      }
    } else {
      setFilterParent('ALL');
      setFilterRuangan('ALL');
    }
  }, [initialFilterRuanganId, ruanganList]);

  const allowedSubIds =
    filterParent !== 'ALL'
      ? new Set(getSubRuanganByParent(ruanganList, filterParent).map((r) => r.id))
      : null;

  const filteredBarang = barangList.filter((b) => {
    if (filterRuangan !== 'ALL') {
      if (b.ruanganId !== filterRuangan) return false;
    } else if (allowedSubIds) {
      if (!allowedSubIds.has(b.ruanganId)) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const roomInfo = resolveBarangRoom(b, ruanganList);
    return (
      b.namaBarang.toLowerCase().includes(q) ||
      b.kodeBarang.toLowerCase().includes(q) ||
      b.nup.toLowerCase().includes(q) ||
      roomInfo.parentName.toLowerCase().includes(q) ||
      roomInfo.subName.toLowerCase().includes(q)
    );
  });

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    barangList.map((b) => b.id)
  );

  useEffect(() => {
    setSelectedIds(filteredBarang.map((b) => b.id));
    setPickerPage(1);
    setPreviewPage(1);
  }, [filterParent, filterRuangan, barangList.length]);

  useEffect(() => {
    setPickerPage(1);
  }, [search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllVisible = () => {
    setSelectedIds(filteredBarang.map((b) => b.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const selectedItems = filteredBarang.filter((b) => selectedIds.includes(b.id));

  const labelsToRender: Array<{ item: Barang; unitIndex: number; totalUnits: number }> = [];
  for (const item of selectedItems) {
    const count = expandPerUnit ? Math.min(20, Math.max(1, item.jumlah)) : 1;
    for (let i = 1; i <= count; i++) {
      labelsToRender.push({ item, unitIndex: i, totalUnits: item.jumlah });
    }
  }

  const pickerPagination = paginateItems(
    filteredBarang,
    pickerPage,
    pickerPageSize
  );
  const previewPagination = paginateItems(
    labelsToRender,
    previewPage,
    previewPageSize
  );

  const qrPixelSize = labelSize === 'compact' ? 60 : labelSize === 'standard' ? 80 : 96;

  return (
    <div className="space-y-6">
      {/* Unboxed Clean Page Header (Hidden on Print) */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-stone-200 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Cetak Label QR Code
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Pilih ruangan dan barang untuk mencetak stiker label QR Code inventaris.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={labelsToRender.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Cetak {labelsToRender.length} Label QR</span>
        </button>
      </div>

      {/* Structured Filter & Preset Bar (Hidden on Print) */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5 space-y-4 no-print">
        {/* Row 1: Search + Ruangan Induk + Sub-Ruangan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div>
            <label htmlFor="qr-filter-parent" className="block text-xs font-semibold text-stone-600 mb-1">
              Ruangan Induk
            </label>
            <select
              id="qr-filter-parent"
              value={filterParent}
              onChange={(e) => {
                setFilterParent(e.target.value);
                setFilterRuangan('ALL');
              }}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="ALL">Semua Ruangan Induk ({parentNames.length})</option>
              {parentNames.map((pName) => (
                <option key={pName} value={pName}>
                  {pName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="qr-filter-ruangan" className="block text-xs font-semibold text-stone-600 mb-1">
              Sub-Ruangan
            </label>
            <select
              id="qr-filter-ruangan"
              value={filterRuangan}
              onChange={(e) => setFilterRuangan(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="ALL">
                {filterParent === 'ALL'
                  ? `Semua Sub-Ruangan (${ruanganList.length})`
                  : `Semua Sub-Ruang di ${filterParent}`}
              </option>
              {subOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {filterParent === 'ALL'
                    ? formatRuanganFullLabel(r)
                    : r.subRuangan || `${r.namaRuangan} (Utama)`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="qr-search-input" className="block text-xs font-semibold text-stone-600 mb-1">
              Cari Kode / Nama Barang
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="qr-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ketik kode, nama, atau sub-ruang..."
                className="w-full h-10 pl-9 pr-3 text-sm text-stone-900 bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Ukuran Stiker + Checkboxes */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-3 border-t border-stone-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-stone-600">
              Ukuran Stiker:
            </span>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-md">
              {(
                [
                  { id: 'compact', label: 'Kecil (3 Kolom)' },
                  { id: 'standard', label: 'Standar (2 Kolom)' },
                  { id: 'large', label: 'Besar (Detail)' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setLabelSize(preset.id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    labelSize === preset.id
                      ? 'bg-white text-stone-900 font-semibold shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Checkboxes & Selection Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-200 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showRuangan}
                onChange={(e) => setShowRuangan(e.target.checked)}
                className="rounded border-stone-300 text-[#0F5C4D]"
              />
              <span>Tampilkan Nama Ruangan</span>
            </label>
            <label className="inline-flex items-center gap-2 text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showUkuranBahan}
                onChange={(e) => setShowUkuranBahan(e.target.checked)}
                className="rounded border-stone-300 text-[#0F5C4D]"
              />
              <span>Tampilkan Ukuran, Bahan & Tahun</span>
            </label>
            <label className="inline-flex items-center gap-2 text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={expandPerUnit}
                onChange={(e) => setExpandPerUnit(e.target.checked)}
                className="rounded border-stone-300 text-[#0F5C4D]"
              />
              <span>Cetak Gandakan Sesuai Jumlah Unit</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 cursor-pointer"
            >
              Pilih Semua ({filteredBarang.length})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
            >
              Reset Pilihan
            </button>
          </div>
        </div>

        {/* Item Picker Table (Paginated for large inventories) */}
        <div className="border border-stone-200 rounded-lg overflow-hidden">
          {filteredBarang.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-stone-500">
              Tidak ada barang yang cocok dengan filter di atas.
            </div>
          ) : (
            <>
              <div className="divide-y divide-stone-200">
                {pickerPagination.pageItems.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className="w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-2.5 text-sm hover:bg-stone-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-[#0F5C4D] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-stone-400 shrink-0" />
                        )}
                        <span className="font-mono text-xs font-semibold text-stone-700 shrink-0">
                          {item.kodeBarang}
                        </span>
                        <span className="font-medium text-stone-900 truncate">
                          {item.namaBarang}
                        </span>
                      </div>
                      <div className="text-xs text-stone-500 font-mono pl-6 sm:pl-0 shrink-0">
                        {item.ruanganNama} · {item.jumlah} {item.satuan}
                      </div>
                    </button>
                  );
                })}
              </div>

              <TablePagination
                compact
                currentPage={pickerPagination.safePage}
                totalPages={pickerPagination.totalPages}
                totalItems={pickerPagination.totalItems}
                startDisplay={pickerPagination.startDisplay}
                endDisplay={pickerPagination.endDisplay}
                pageSize={pickerPagination.pageSize}
                onPageChange={setPickerPage}
                onPageSizeChange={(nextSize) => {
                  setPickerPageSize(nextSize);
                  setPickerPage(1);
                }}
                pageSizeOptions={[10, 25, 50]}
                itemLabel="barang"
              />
            </>
          )}
        </div>
      </div>

      {/* Printable Sticker Sheet */}
      <div className="bg-white border border-stone-200 rounded-lg p-6 print-sheet">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-200 no-print">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            <QrCode className="w-4 h-4 text-[#0F5C4D]" />
            <span>Pratinjau Lembar Stiker QR Code ({labelsToRender.length} Label Siap Cetak)</span>
          </div>
          <span className="text-xs text-stone-500">
            Gunakan kertas stiker A4 atau thermal label printer
          </span>
        </div>

        {labelsToRender.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-500">
            Pilih minimal satu barang inventaris di atas untuk menampilkan pratinjau stiker QR Code.
          </div>
        ) : (
          <>
            <div
              className={`grid gap-4 ${
                labelSize === 'compact'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 md:grid-cols-2'
              }`}
            >
              {labelsToRender.map(({ item, unitIndex, totalUnits }, idx) => {
                const isVisibleOnScreen =
                  idx >= previewPagination.startIndex &&
                  idx < previewPagination.endIndex;
                return (
                  <div
                    key={`${item.id}-${unitIndex}-${idx}`}
                    className={`border-2 border-slate-900 rounded-md overflow-hidden bg-white break-inside-avoid ${
                      isVisibleOnScreen ? '' : 'hidden print:block'
                    }`}
                  >
                {/* Top Official Bar */}
                <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-[10px]">
                  <span className="font-bold tracking-wide truncate">
                    {instansi.kotaKab} — {instansi.unit}
                  </span>
                  <span className="font-mono shrink-0 ml-2">
                    {instansi.kodeLokasi}
                  </span>
                </div>

                {/* Body: QR + Code Table */}
                <div className="p-3 flex items-center gap-3">
                  <div className="p-1 border border-stone-300 rounded bg-white shrink-0">
                    <QrCodeSvg
                      value={buildQrPayload(item, instansi.kodeLokasi)}
                      size={qrPixelSize}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 text-xs">
                    <div className="grid grid-cols-3 border-b border-stone-200 pb-1 text-[11px]">
                      <div className="col-span-2">
                        <span className="text-[10px] text-stone-500 block">NO. KODE BARANG</span>
                        <span className="font-mono font-bold text-stone-900">
                          {item.kodeBarang}
                        </span>
                      </div>
                      <div className="border-l border-stone-200 pl-2">
                        <span className="text-[10px] text-stone-500 block">
                          {expandPerUnit && totalUnits > 1 ? 'UNIT' : 'TAHUN'}
                        </span>
                        <span className="font-mono font-bold text-stone-900">
                          {expandPerUnit && totalUnits > 1
                            ? `${unitIndex}/${totalUnits}`
                            : item.tahunPerolehan}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-stone-900 truncate">
                        {item.namaBarang}
                      </div>
                      <div className="text-[11px] text-stone-600 truncate">
                        {item.merkTipe || '-'} {item.nomorSeri ? `· SN: ${item.nomorSeri}` : ''}
                      </div>
                    </div>

                    {showRuangan && (
                      <div className="text-[11px] text-stone-700 truncate">
                        Ruangan: <strong className="text-stone-900">{item.ruanganNama}</strong>
                      </div>
                    )}

                    {showUkuranBahan && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 pt-0.5 border-t border-slate-100">
                        <span>
                          {item.ukuran ? `${item.ukuran} · ` : ''}{item.bahan} ({item.tahunPerolehan})
                        </span>
                        <span>Keadaan: {item.kondisi}</span>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              );
              })}
            </div>

            {labelsToRender.length > 0 && (
              <div className="mt-5 -mx-6 -mb-6 rounded-b-lg overflow-hidden no-print">
                <TablePagination
                  currentPage={previewPagination.safePage}
                  totalPages={previewPagination.totalPages}
                  totalItems={previewPagination.totalItems}
                  startDisplay={previewPagination.startDisplay}
                  endDisplay={previewPagination.endDisplay}
                  pageSize={previewPagination.pageSize}
                  onPageChange={setPreviewPage}
                  onPageSizeChange={(nextSize) => {
                    setPreviewPageSize(nextSize);
                    setPreviewPage(1);
                  }}
                  pageSizeOptions={[12, 24, 48]}
                  itemLabel="label QR"
                  helperNote="Tombol Cetak tetap mencetak seluruh label terpilih."
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
