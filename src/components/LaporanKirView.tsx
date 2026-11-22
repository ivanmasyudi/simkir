import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  ImagePlus,
  Printer,
  Settings2,
  Trash2,
} from 'lucide-react';
import { Barang, InstansiSetting, Ruangan } from '../types/kir';
import {
  consolidateKirReportRows,
  generateKirCsv,
  getConditionCounts,
  getSubRuanganByParent,
  getUniqueParentRuanganNames,
} from '../utils/kirLogic';
import {
  buildKirExcelBuffer,
  resolveLogoPngBase64InBrowser,
} from '../utils/kirExcelExport';
import { TablePagination } from './TablePagination';
import { paginateItems } from '../utils/tablePagination';

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
  const [showConfig, setShowConfig] = useState(false);
  const [startUrut, setStartUrut] = useState<number>(21);
  const [tanggalCetak, setTanggalCetak] = useState('21 November 2026');
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

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

  const parentSubIds =
    selectedParentName !== 'ALL'
      ? new Set(
          getSubRuanganByParent(ruanganList, selectedParentName).map((r) => r.id)
        )
      : null;

  const reportItems = barangList.filter((b) => {
    if (selectedRuanganId !== 'ALL') {
      if (b.ruanganId !== selectedRuanganId) return false;
    } else if (selectedParentName !== 'ALL' && parentSubIds) {
      if (!parentSubIds.has(b.ruanganId)) return false;
    }
    if (filterKondisi !== 'ALL' && b.kondisi !== filterKondisi) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedParentName, selectedRuanganId, filterKondisi, consolidateSameItems]);

  const reportRows = consolidateKirReportRows(reportItems, {
    ruangan: currentRuangan,
    ruanganList,
    consolidateSameItems,
  });

  const pagination = paginateItems(reportRows, currentPage, pageSize);

  const totalUnits = reportItems.reduce(
    (acc, b) => acc + (Number(b.jumlah) || 0),
    0
  );
  const countBaik = reportItems.reduce(
    (acc, b) => acc + getConditionCounts(b).baik,
    0
  );
  const countKurangBaik = reportItems.reduce(
    (acc, b) => acc + getConditionCounts(b).kurangBaik,
    0
  );
  const countRusakBerat = reportItems.reduce(
    (acc, b) => acc + getConditionCounts(b).rusakBerat,
    0
  );

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

  const handleDownloadExcel = async () => {
    try {
      setIsExportingExcel(true);
      const logoImg = await resolveLogoPngBase64InBrowser(instansi.logoUrl);
      const buffer = await buildKirExcelBuffer(
        reportItems,
        instansi,
        currentRuangan,
        {
          startUrut,
          tanggalCetak,
          parentRuanganName: selectedParentName,
          ruanganList,
          consolidateSameItems,
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
        ? selectedParentName.replace(/[^a-zA-Z0-9]+/g, '-')
        : 'SEMUA-RUANGAN';
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
    const csvContent = generateKirCsv(
      reportItems,
      currentRuangan,
      startUrut,
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

  const kopNamaRuangan = currentRuangan
    ? currentRuangan.namaRuangan
    : selectedParentName !== 'ALL'
    ? selectedParentName
    : 'SELURUH RUANGAN';

  const kopSubRuangan = currentRuangan?.subRuangan
    ? `( ${currentRuangan.subRuangan} )`
    : selectedParentName !== 'ALL'
    ? '( SEMUA SUB-RUANGAN )'
    : '( REKAPITULASI INVENTARIS )';

  const fallbackPjRoom =
    currentRuangan ||
    (selectedParentName !== 'ALL'
      ? getSubRuanganByParent(ruanganList, selectedParentName)[0]
      : undefined);

  return (
    <div className="space-y-6">
      {/* Unboxed Clean Page Header (No Print) */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-stone-200 pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Cetak Laporan KIR
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Pilih ruangan induk &amp; sub-ruangan untuk mencetak Kartu Inventaris Ruangan 13 kolom atau ekspor ke Excel.
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
            disabled={isExportingExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isExportingExcel ? 'Membuat Excel...' : 'Excel (.xlsx)'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak KIR</span>
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

        {/* Row 2: Nomor Urut, Tanggal Pengesahan, Konsolidasi */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-stone-200 items-end">
          <div>
            <label
              htmlFor="laporan-no-urut-awal"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              Mulai Nomor Urut (Kolom 1)
            </label>
            <input
              id="laporan-no-urut-awal"
              type="number"
              min={1}
              value={startUrut}
              onChange={(e) =>
                setStartUrut(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-full h-10 px-3 text-sm font-mono text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

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
              Menampilkan{' '}
              <strong className="text-stone-900">{reportRows.length}</strong>{' '}
              baris dari {reportItems.length} barang
            </span>
          </div>
        </div>

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
                  Pengaturan Kop Kartu Inventaris Ruangan (Kiri, Kanan & Logo Daerah)
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
                    onClick={() => onUpdateInstansi({ ...instansi, logoUrl: '' })}
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
              <div>
                <label
                  htmlFor="kop-halaman"
                  className="block text-[11px] font-semibold text-stone-700 mb-1"
                >
                  Halaman (Kanan)
                </label>
                <input
                  id="kop-halaman"
                  type="text"
                  value={instansi.halaman}
                  onChange={(e) =>
                    onUpdateInstansi({ ...instansi, halaman: e.target.value })
                  }
                  placeholder="2"
                  className="w-full px-2.5 py-1.5 font-mono bg-white border border-stone-300 rounded"
                />
              </div>
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-3 border-t border-stone-200">
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
                  <rect x="30" y="68" width="40" height="10" rx="2" fill="#ffffff" />
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

          {/* Right Side: No. Kode Lokasi, Nama Ruangan Induk, (Sub-Ruangan), Tahun, Halaman */}
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
                    {kopNamaRuangan}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 pr-2"></td>
                  <td className="py-0.5 px-1"></td>
                  <td className="py-0.5 font-semibold text-left uppercase">
                    {kopSubRuangan}
                  </td>
                </tr>
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
                  <td className="py-0.5 font-mono text-left">
                    {instansi.halaman}
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
                <th rowSpan={2} className="border border-slate-900 py-2 px-1.5 w-10">
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
              {reportRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="border border-slate-900 py-8 text-center text-stone-500"
                  >
                    Tidak ada data inventaris barang pada sub-ruangan/kriteria ini.
                  </td>
                </tr>
              ) : (
                reportRows.map((row, idx) => {
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
                        {startUrut + idx}
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
                      <div className="text-[10px] uppercase">{row.satuan}</div>
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
                  {totalUnits} UNIT
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {countBaik}
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {countKurangBaik}
                </td>
                <td className="border border-slate-900 py-2 px-2 text-center font-mono tabular-nums">
                  {countRusakBerat}
                </td>
                <td className="border border-slate-900 py-2 px-2.5 text-center">
                  {reportRows.length} Jenis
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Screen-only pagination (Print & Excel always include 100% of rows) */}
        {reportRows.length > 0 && (
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
              <div className="font-bold underline text-stone-900">
                {fallbackPjRoom
                  ? fallbackPjRoom.penanggungJawab
                  : instansi.namaKepalaUnit}
              </div>
              <div className="font-mono text-[11px] text-stone-600">
                NIP.{' '}
                {fallbackPjRoom
                  ? fallbackPjRoom.nipPenanggungJawab
                  : instansi.nipKepalaUnit}
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
