import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  ImagePlus,
  Layers,
  Printer,
  Settings2,
  SplitSquareVertical,
  Trash2,
} from 'lucide-react';
import { Barang, InstansiSetting, Ruangan } from '../types/kir';
import {
  buildKirRoomSections,
  generateKirCsv,
  getSubRuanganByParent,
  getUniqueParentRuanganNames,
} from '../utils/kirLogic';
import {
  buildKirExcelBuffer,
  resolveLogoPngBase64InBrowser,
} from '../utils/kirExcelExport';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { KirDocumentSheet } from './KirDocumentSheet';

interface LaporanKirViewProps {
  barangList: Barang[];
  ruanganList: Ruangan[];
  instansi: InstansiSetting;
  initialFilterRuanganId?: string;
  onUpdateInstansi: (next: InstansiSetting) => void;
}

export const LaporanKirView: React.FC<LaporanKirViewProps> = ({
  barangList,
  ruanganList,
  instansi,
  initialFilterRuanganId = 'ALL',
  onUpdateInstansi,
}) => {
  const initialRoomObj =
    initialFilterRuanganId !== 'ALL'
      ? ruanganList.find((r) => r.id === initialFilterRuanganId)
      : ruanganList[0];

  const [selectedParentName, setSelectedParentName] = useState<string>(
    initialRoomObj?.namaRuangan ?? 'ALL'
  );
  const [selectedRuanganId, setSelectedRuanganId] = useState<string>(
    initialRoomObj?.id ?? 'ALL'
  );
  const [filterKondisi, setFilterKondisi] = useState('ALL');
  const [consolidateSameItems, setConsolidateSameItems] = useState(true);
  const [splitByRoom, setSplitByRoom] = useState(true);
  const [includeEmptyRooms, setIncludeEmptyRooms] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [tanggalCetak, setTanggalCetak] = useState('21 November 2026');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isConfirmResetLogoOpen, setIsConfirmResetLogoOpen] = useState(false);

  const parentRuanganNames = getUniqueParentRuanganNames(ruanganList);
  const availableSubRuangan =
    selectedParentName === 'ALL'
      ? ruanganList
      : getSubRuanganByParent(ruanganList, selectedParentName);

  useEffect(() => {
    if (initialFilterRuanganId && initialFilterRuanganId !== 'ALL') {
      const target = ruanganList.find((r) => r.id === initialFilterRuanganId);
      if (target) {
        setSelectedParentName(target.namaRuangan);
        setSelectedRuanganId(target.id);
      }
    }
  }, [initialFilterRuanganId, ruanganList]);

  const currentRuangan =
    selectedRuanganId !== 'ALL'
      ? ruanganList.find((r) => r.id === selectedRuanganId)
      : undefined;

  const isMultiRoomSelection =
    selectedRuanganId === 'ALL' && availableSubRuangan.length > 0;
  const isSplitModeActive = isMultiRoomSelection && splitByRoom;

  const sections = buildKirRoomSections(barangList, ruanganList, {
    selectedParentName,
    selectedRuanganId,
    filterKondisi,
    consolidateSameItems,
    splitByRoom,
    includeEmptyRooms,
    fallbackDirekturNama: instansi.namaKepalaUnit,
    fallbackDirekturNip: instansi.nipKepalaUnit,
  });

  const totalRowsAcrossSections = sections.reduce(
    (acc, sec) => acc + sec.rows.length,
    0
  );
  const totalItemsAcrossSections = sections.reduce(
    (acc, sec) => acc + sec.items.length,
    0
  );
  const renderedRoomCount = sections.filter((s) => Boolean(s.ruangan)).length;
  const skippedEmptyCount =
    isSplitModeActive && !includeEmptyRooms
      ? Math.max(0, availableSubRuangan.length - renderedRoomCount)
      : 0;

  const handleParentChange = (nextParent: string) => {
    setSelectedParentName(nextParent);
    if (nextParent === 'ALL') {
      setSelectedRuanganId('ALL');
    } else {
      const subs = getSubRuanganByParent(ruanganList, nextParent);
      setSelectedRuanganId(subs[0]?.id ?? 'ALL');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateInstansi({ ...instansi, logoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleJumpToSheet = (sectionKey: string) => {
    if (!sectionKey) return;
    const el = document.getElementById(`kir-sheet-${sectionKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDownloadExcel = async () => {
    try {
      setIsExportingExcel(true);
      const logoImg = await resolveLogoPngBase64InBrowser(instansi.logoUrl);
      const allFilteredItems = sections.flatMap((s) => s.items);
      const buffer = await buildKirExcelBuffer(
        allFilteredItems,
        instansi,
        currentRuangan,
        {
          tanggalCetak,
          parentRuanganName: selectedParentName,
          ruanganList,
          consolidateSameItems,
          splitByRoom: isSplitModeActive,
          includeEmptyRooms,
          sections,
          logoBase64: logoImg?.base64,
          logoExtension: logoImg?.extension,
        }
      );

      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const roomSlug = currentRuangan
        ? `${currentRuangan.kodeRuangan}-${(
            currentRuangan.subRuangan || currentRuangan.namaRuangan
          ).replace(/[^a-zA-Z0-9]+/g, '-')}`
        : selectedParentName !== 'ALL'
        ? `${selectedParentName.replace(/[^a-zA-Z0-9]+/g, '-')}${
            isSplitModeActive ? '-PER-RUANG' : '-REKAP'
          }`
        : isSplitModeActive
        ? 'SEMUA-RUANGAN-PER-RUANG'
        : 'SEMUA-RUANGAN-REKAP';
      a.href = url;
      a.download = `KARTU-INVENTARIS-RUANGAN-${roomSlug}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleDownloadCsv = () => {
    const allFilteredItems = sections.flatMap((s) => s.items);
    const csvContent = generateKirCsv(
      allFilteredItems,
      currentRuangan,
      1,
      ruanganList,
      consolidateSameItems
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const roomSlug = currentRuangan
      ? currentRuangan.kodeRuangan
      : selectedParentName !== 'ALL'
      ? selectedParentName.replace(/[^a-zA-Z0-9]+/g, '-')
      : 'SEMUA-RUANGAN';
    a.href = url;
    a.download = `LAPORAN-KIR-${roomSlug}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Unboxed Clean Page Header (No Print) */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-stone-200 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Cetak Laporan KIR
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Pilih ruangan induk &amp; sub-ruangan untuk mencetak Kartu Inventaris Ruangan 13 kolom per ruangan atau ekspor ke Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfig((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
            <span>
              {showConfig ? 'Tutup Atur Kop' : 'Atur Kop & Logo'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel || sections.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? 'Membuat Excel...' : 'Excel (.xlsx)'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={sections.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={sections.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>
              {isSplitModeActive && sections.length > 1
                ? `Cetak KIR (${sections.length} Ruang)`
                : 'Cetak KIR'}
            </span>
          </button>
        </div>
      </div>

      {/* Control Toolbar (No Print) */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5 space-y-4 no-print">
        {/* Row 1: Ruangan Induk, Sub-Ruangan, Keadaan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div>
            <label
              htmlFor="laporan-select-parent"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              1. Ruangan Induk
            </label>
            <select
              id="laporan-select-parent"
              value={selectedParentName}
              onChange={(e) => handleParentChange(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              {parentRuanganNames.map((pName) => (
                <option key={pName} value={pName}>
                  {pName}
                </option>
              ))}
              <option value="ALL">
                Rekapitulasi Seluruh Ruangan ({parentRuanganNames.length})
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="laporan-select-ruangan"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              2. Sub-Ruangan KIR
            </label>
            <select
              id="laporan-select-ruangan"
              value={selectedRuanganId}
              onChange={(e) => setSelectedRuanganId(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              {availableSubRuangan.map((r) => (
                <option key={r.id} value={r.id}>
                  {selectedParentName === 'ALL'
                    ? `${r.namaRuangan} — ${r.subRuangan || 'Utama'}`
                    : r.subRuangan || `${r.namaRuangan} (Utama)`}
                </option>
              ))}
              <option value="ALL">
                {selectedParentName === 'ALL'
                  ? 'Semua Sub-Ruangan'
                  : `Semua Sub-Ruang di ${selectedParentName}`}
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="laporan-filter-kondisi"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              3. Keadaan Barang
            </label>
            <select
              id="laporan-filter-kondisi"
              value={filterKondisi}
              onChange={(e) => setFilterKondisi(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="ALL">Semua Keadaan</option>
              <option value="Baik">Hanya Baik</option>
              <option value="Kurang Baik">Hanya Kurang Baik</option>
              <option value="Rusak Berat">Hanya Rusak Berat</option>
            </select>
          </div>
        </div>

        {/* Row 2: Tanggal Pengesahan & Ringkasan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-stone-200 items-end">
          <div>
            <label
              htmlFor="laporan-tgl-cetak"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              Tanggal Pengesahan
            </label>
            <input
              id="laporan-tgl-cetak"
              type="text"
              value={tanggalCetak}
              onChange={(e) => setTanggalCetak(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div className="flex items-center justify-between md:justify-end h-10 text-xs font-mono text-stone-600">
            <span>
              {isSplitModeActive ? (
                <>
                  Siap cetak{' '}
                  <strong className="text-stone-900">{sections.length}</strong>{' '}
                  lembar sub-ruangan ({totalRowsAcrossSections} baris KIR) · No. Urut reset per ruang
                </>
              ) : (
                <>
                  Menampilkan{' '}
                  <strong className="text-stone-900">
                    {totalRowsAcrossSections}
                  </strong>{' '}
                  baris dari {totalItemsAcrossSections} barang · No. Urut &amp; Halaman otomatis
                </>
              )}
            </span>
          </div>
        </div>

        {/* Row 3: Multi-Room Print & Excel Mode Switcher (only shown when ALL sub-ruangan selected) */}
        {isMultiRoomSelection && (
          <div className="pt-3 border-t border-stone-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-stone-700">
                  Mode Tata Letak Cetak &amp; Excel Multi-Ruangan
                </div>
                <div
                  className="inline-flex rounded-md border border-stone-300 bg-stone-50 p-0.5"
                  role="group"
                  aria-label="Mode tata letak cetak multi-ruangan"
                >
                  <button
                    type="button"
                    id="mode-split-per-room"
                    onClick={() => setSplitByRoom(true)}
                    aria-pressed={splitByRoom}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      splitByRoom
                        ? 'bg-[#0F5C4D] text-white'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5" />
                    <span>Pisah Halaman per Sub-Ruangan</span>
                  </button>
                  <button
                    type="button"
                    id="mode-combine-single"
                    onClick={() => setSplitByRoom(false)}
                    aria-pressed={!splitByRoom}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors cursor-pointer ${
                      !splitByRoom
                        ? 'bg-[#0F5C4D] text-white'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Gabung Jadi 1 Rekap</span>
                  </button>
                </div>
              </div>

              {splitByRoom && sections.length > 1 && (
                <div className="w-full lg:w-72">
                  <label
                    htmlFor="laporan-jump-sheet"
                    className="block text-[11px] font-semibold text-stone-600 mb-1"
                  >
                    Lompat ke Lembar Sub-Ruangan
                  </label>
                  <select
                    id="laporan-jump-sheet"
                    defaultValue=""
                    onChange={(e) => {
                      handleJumpToSheet(e.target.value);
                      e.target.value = '';
                    }}
                    className="w-full h-9 px-2.5 text-xs text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
                  >
                    <option value="">
                      Pilih lembar ({sections.length} sub-ruangan)...
                    </option>
                    {sections.map((sec, idx) => (
                      <option key={sec.sectionKey} value={sec.sectionKey}>
                        {idx + 1}. {sec.namaRuangan}
                        {sec.ruangan?.subRuangan
                          ? ` — ${sec.ruangan.subRuangan}`
                          : ''}{' '}
                        ({sec.totalUnits} unit)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {splitByRoom && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 bg-[#F4F8F7] border border-[#CFE3DE] rounded-md text-xs text-stone-700">
                <label
                  htmlFor="toggle-include-empty-rooms"
                  className="inline-flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    id="toggle-include-empty-rooms"
                    type="checkbox"
                    checked={includeEmptyRooms}
                    onChange={(e) => setIncludeEmptyRooms(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-300 text-[#0F5C4D] focus:ring-[#0F5C4D]"
                  />
                  <span>
                    Sertakan sub-ruangan kosong (0 barang)
                    {skippedEmptyCount > 0 && (
                      <span className="ml-1 text-stone-500">
                        ({skippedEmptyCount} ruang kosong dilewati otomatis)
                      </span>
                    )}
                  </span>
                </label>
                <span className="text-[11px] text-[#0F5C4D] font-medium">
                  Cetak PDF pisah halaman · Excel 1 sheet ringan + page break per ruangan
                </span>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-stone-100">
          <label
            htmlFor="toggle-consolidate-kir"
            className="inline-flex items-start sm:items-center gap-2.5 text-sm text-stone-700 cursor-pointer select-none"
          >
            <input
              id="toggle-consolidate-kir"
              type="checkbox"
              checked={consolidateSameItems}
              onChange={(e) => setConsolidateSameItems(e.target.checked)}
              className="w-4 h-4 mt-0.5 sm:mt-0 rounded border-stone-300 text-[#0F5C4D] focus:ring-[#0F5C4D]"
            />
            <span>
              <strong className="font-semibold text-stone-900">
                Gabungkan barang sama dalam 1 baris KIR
              </strong>{' '}
              (otomatis menjumlahkan kolom Baik, Kurang Baik, dan Rusak Berat di ruangan yang sama)
            </span>
          </label>
        </div>

        {/* Form Input Kop Laporan KIR */}
        {showConfig && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200 pb-2.5">
              <div>
                <div className="text-xs font-bold text-stone-900">
                  Pengaturan Kop Kartu Inventaris Ruangan (Kiri, Kanan &amp; Logo Daerah)
                </div>
                <div className="text-[11px] text-stone-500">
                  Sesuaikan identitas Provinsi, Kota/Kab, Unit, Satuan Kerja, No. Kode Lokasi, serta unggah logo kop instansi.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F5C4D] bg-[#EBF4F2] border border-[#C7DFD9] rounded-lg hover:bg-[#DCECE8] cursor-pointer">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Unggah Logo Kop</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {instansi.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmResetLogoOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset Logo</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label
                  htmlFor="kop-propinsi"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  PROPINSI (Kiri)
                </label>
                <input
                  id="kop-propinsi"
                  type="text"
                  value={instansi.propinsi}
                  onChange={(e) =>
                    onUpdateInstansi({ ...instansi, propinsi: e.target.value })
                  }
                  placeholder="JAWA TIMUR"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-kotakab"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  KOTA/KAB (Kiri)
                </label>
                <input
                  id="kop-kotakab"
                  type="text"
                  value={instansi.kotaKab}
                  onChange={(e) =>
                    onUpdateInstansi({ ...instansi, kotaKab: e.target.value })
                  }
                  placeholder="BANGKALAN"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-unit"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  UNIT (Kiri)
                </label>
                <input
                  id="kop-unit"
                  type="text"
                  value={instansi.unit}
                  onChange={(e) =>
                    onUpdateInstansi({ ...instansi, unit: e.target.value })
                  }
                  placeholder="UOBK RSUD SYARIFAH AMBAMI RATO EBU"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-satker"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  SATUAN KERJA (Kiri)
                </label>
                <input
                  id="kop-satker"
                  type="text"
                  value={instansi.satuanKerja}
                  onChange={(e) =>
                    onUpdateInstansi({
                      ...instansi,
                      satuanKerja: e.target.value,
                    })
                  }
                  placeholder="UOBK RSUD SYARIFAH AMBAMI RATO EBU"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-stone-200">
              <div>
                <label
                  htmlFor="kop-kodelokasi"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  NO. KODE LOKASI (Kanan)
                </label>
                <input
                  id="kop-kodelokasi"
                  type="text"
                  value={instansi.kodeLokasi}
                  onChange={(e) =>
                    onUpdateInstansi({ ...instansi, kodeLokasi: e.target.value })
                  }
                  placeholder="13290702000000"
                  className="w-full px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-tahun-pelaporan"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  Tahun data pelaporan (Kanan)
                </label>
                <input
                  id="kop-tahun-pelaporan"
                  type="text"
                  value={instansi.tahunPelaporan}
                  onChange={(e) =>
                    onUpdateInstansi({
                      ...instansi,
                      tahunPelaporan: e.target.value,
                    })
                  }
                  placeholder="2002 s.d 2025"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-3 border-t border-stone-200">
              <div>
                <label
                  htmlFor="kop-direktur"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  Nama Direktur
                </label>
                <input
                  id="kop-direktur"
                  type="text"
                  value={instansi.namaKepalaUnit}
                  onChange={(e) =>
                    onUpdateInstansi({
                      ...instansi,
                      namaKepalaUnit: e.target.value,
                    })
                  }
                  placeholder="dr. H. Farhat Suryaningrat, Sp.KK"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-nip-direktur"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  NIP Direktur
                </label>
                <input
                  id="kop-nip-direktur"
                  type="text"
                  value={instansi.nipKepalaUnit}
                  onChange={(e) =>
                    onUpdateInstansi({
                      ...instansi,
                      nipKepalaUnit: e.target.value,
                    })
                  }
                  placeholder="197508142001121003"
                  className="w-full px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-pengurus"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  Nama Pengurus Barang (TTD)
                </label>
                <input
                  id="kop-pengurus"
                  type="text"
                  value={instansi.namaPengurusBarang}
                  onChange={(e) =>
                    onUpdateInstansi({
                      ...instansi,
                      namaPengurusBarang: e.target.value,
                    })
                  }
                  placeholder="Rizky Pratama Putra, S.Tr.Ak"
                  className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded"
                />
              </div>
              <div>
                <label
                  htmlFor="kop-nip-pengurus"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  NIP Pengurus Barang
                </label>
                <input
                  id="kop-nip-pengurus"
                  type="text"
                  value={instansi.nipPengurusBarang}
                  onChange={(e) =>
                    onUpdateInstansi({
                      ...instansi,
                      nipPengurusBarang: e.target.value,
                    })
                  }
                  placeholder="199104222015031005"
                  className="w-full px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rendered Official KIR Document Sheet(s) */}
      {sections.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center space-y-3 no-print">
          <p className="text-sm font-semibold text-stone-800">
            Tidak ada sub-ruangan yang memiliki barang untuk kriteria filter saat ini.
          </p>
          <p className="text-xs text-stone-500">
            Sub-ruangan kosong otomatis dilewati pada mode cetak pisah per ruangan agar tidak membuang kertas.
          </p>
          {isSplitModeActive && availableSubRuangan.length > 0 && (
            <button
              type="button"
              onClick={() => setIncludeEmptyRooms(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0F5C4D] bg-[#EBF4F2] border border-[#C7DFD9] rounded-md hover:bg-[#DCECE8] transition-colors cursor-pointer"
            >
              Tampilkan Sub-Ruangan Kosong ({availableSubRuangan.length})
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8 print:space-y-0">
          {sections.map((section, idx) => (
            <KirDocumentSheet
              key={section.sectionKey}
              section={section}
              instansi={instansi}
              tanggalCetak={tanggalCetak}
              pageBreakBefore={idx > 0}
              sheetIndex={idx + 1}
              totalSheets={sections.length}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isConfirmResetLogoOpen}
        title="Hapus Logo Kop Instansi?"
        description="Logo yang sudah diunggah akan dihapus dari kop laporan KIR dan export Excel."
        itemName={instansi.unit}
        confirmLabel="Ya, Hapus Logo"
        onCancel={() => setIsConfirmResetLogoOpen(false)}
        onConfirm={() => {
          onUpdateInstansi({ ...instansi, logoUrl: '' });
          setIsConfirmResetLogoOpen(false);
        }}
      />
    </div>
  );
};

