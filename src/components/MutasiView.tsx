import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  FileText,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react';
import {
  Barang,
  InstansiSetting,
  JenisMutasi,
  KondisiBarang,
  Mutasi,
  Ruangan,
} from '../types/kir';
import {
  formatRuanganFullLabel,
  getSubRuanganByParent,
  getUniqueParentRuanganNames,
  KONDISI_LIST,
  resolveBarangRoom,
  sanitizeId,
  validateMutasiInput,
} from '../utils/kirLogic';
import { TablePagination } from './TablePagination';
import {
  MutasiSortKey,
  paginateItems,
  SortDirection,
  sortMutasiList,
} from '../utils/tablePagination';

interface MutasiViewProps {
  mutasiList: Mutasi[];
  barangList: Barang[];
  ruanganList: Ruangan[];
  instansi: InstansiSetting;
  preselectedBarang?: Barang | null;
  triggerOpenAddModal?: number;
  onRecordMutasi: (mutasi: Mutasi) => Promise<void>;
}

export const MutasiView: React.FC<MutasiViewProps> = ({
  mutasiList,
  barangList,
  ruanganList,
  instansi,
  preselectedBarang = null,
  triggerOpenAddModal = 0,
  onRecordMutasi,
}) => {
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('ALL');
  const [sortBy, setSortBy] = useState<MutasiSortKey>('tanggalMutasi');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBast, setSelectedBast] = useState<Mutasi | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [nomorBeritaAcara, setNomorBeritaAcara] = useState('');
  const [tanggalMutasi, setTanggalMutasi] = useState('2026-11-21');
  const [jenisMutasi, setJenisMutasi] = useState<JenisMutasi>('Perpindahan Ruangan');
  const [asalParentName, setAsalParentName] = useState('');
  const [asalRuanganId, setAsalRuanganId] = useState('');
  const [barangId, setBarangId] = useState('');
  const [tujuanParentName, setTujuanParentName] = useState('');
  const [ruanganTujuanId, setRuanganTujuanId] = useState('');
  const [kondisiAkhir, setKondisiAkhir] = useState<KondisiBarang>('Baik');
  const [petugasInput, setPetugasInput] = useState(instansi.namaPengurusBarang);
  const [alasanMutasi, setAlasanMutasi] = useState('');

  const parentRuanganNames = getUniqueParentRuanganNames(ruanganList);
  const asalSubOptions = getSubRuanganByParent(ruanganList, asalParentName);
  const barangInAsalRoom = barangList.filter(
    (b) => asalRuanganId && b.ruanganId === asalRuanganId
  );
  const tujuanSubOptions = getSubRuanganByParent(ruanganList, tujuanParentName);

  const pickDefaultDestinationRoom = (originRoomId: string) => {
    const originRoom = ruanganList.find((r) => r.id === originRoomId);
    const sameParentOtherSub = originRoom
      ? ruanganList.find(
          (r) =>
            r.namaRuangan === originRoom.namaRuangan && r.id !== originRoom.id
        )
      : undefined;
    return (
      sameParentOtherSub ||
      ruanganList.find((r) => r.id !== originRoomId) ||
      ruanganList[0]
    );
  };

  const handleChangeAsalParent = (newParent: string) => {
    setAsalParentName(newParent);
    const subs = getSubRuanganByParent(ruanganList, newParent);
    // Prefer the first sub-room in this parent that actually has items
    const subWithItems = subs.find((s) =>
      barangList.some((b) => b.ruanganId === s.id)
    );
    const nextSub = subWithItems || subs[0];
    const nextSubId = nextSub?.id || '';
    setAsalRuanganId(nextSubId);

    const itemsInNext = barangList.filter((b) => b.ruanganId === nextSubId);
    const firstItem = itemsInNext[0];
    setBarangId(firstItem?.id || '');
    if (firstItem) {
      setKondisiAkhir(firstItem.kondisi);
    }

    if (ruanganTujuanId === nextSubId) {
      const diffRoom = pickDefaultDestinationRoom(nextSubId);
      if (diffRoom) {
        setTujuanParentName(diffRoom.namaRuangan);
        setRuanganTujuanId(diffRoom.id);
      }
    }
  };

  const handleChangeAsalSubRuangan = (newSubId: string) => {
    setAsalRuanganId(newSubId);
    const itemsInNext = barangList.filter((b) => b.ruanganId === newSubId);
    const firstItem = itemsInNext[0];
    setBarangId(firstItem?.id || '');
    if (firstItem) {
      setKondisiAkhir(firstItem.kondisi);
    }

    if (ruanganTujuanId === newSubId) {
      const diffRoom = pickDefaultDestinationRoom(newSubId);
      if (diffRoom) {
        setTujuanParentName(diffRoom.namaRuangan);
        setRuanganTujuanId(diffRoom.id);
      }
    }
  };

  const handleChangeTujuanParent = (newParent: string) => {
    setTujuanParentName(newParent);
    const subs = getSubRuanganByParent(ruanganList, newParent);
    const preferred = subs.find((s) => s.id !== asalRuanganId) || subs[0];
    setRuanganTujuanId(preferred?.id || '');
  };

  const openNewMutasiModal = (targetBarang?: Barang | null) => {
    const defaultOriginRoom = targetBarang
      ? ruanganList.find((r) => r.id === targetBarang.ruanganId)
      : ruanganList.find((r) => barangList.some((b) => b.ruanganId === r.id)) ||
        ruanganList[0];

    const originId = defaultOriginRoom?.id || targetBarang?.ruanganId || '';
    const originParent =
      defaultOriginRoom?.namaRuangan || parentRuanganNames[0] || '';
    const itemsInOrigin = barangList.filter((b) => b.ruanganId === originId);
    const chosen = targetBarang || itemsInOrigin[0];

    const nextIdx = String(mutasiList.length + 1).padStart(3, '0');
    setNomorBeritaAcara(`BAST/KIR/2026/11/${nextIdx}`);
    setTanggalMutasi(new Date().toISOString().slice(0, 10));
    setJenisMutasi('Perpindahan Ruangan');
    setAsalParentName(originParent);
    setAsalRuanganId(originId);
    setBarangId(chosen?.id || '');

    const diffRoom = pickDefaultDestinationRoom(originId);
    setTujuanParentName(diffRoom?.namaRuangan || parentRuanganNames[0] || '');
    setRuanganTujuanId(diffRoom?.id || '');
    setKondisiAkhir(chosen?.kondisi || 'Baik');
    setPetugasInput(instansi.namaPengurusBarang);
    setAlasanMutasi('');
    setFormError(null);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (preselectedBarang) {
      openNewMutasiModal(preselectedBarang);
    }
  }, [preselectedBarang]);

  useEffect(() => {
    if (triggerOpenAddModal > 0) {
      openNewMutasiModal(null);
    }
  }, [triggerOpenAddModal]);

  const selectedBarangObj = barangList.find((b) => b.id === barangId);
  const selectedBarangRoomInfo = selectedBarangObj
    ? resolveBarangRoom(selectedBarangObj, ruanganList)
    : null;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterJenis, sortBy, sortDir]);

  const filteredMutasi = mutasiList.filter((m) => {
    if (filterJenis !== 'ALL' && m.jenisMutasi !== filterJenis) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.nomorBeritaAcara.toLowerCase().includes(q) ||
      m.namaBarang.toLowerCase().includes(q) ||
      m.kodeBarang.toLowerCase().includes(q) ||
      m.ruanganAsalNama.toLowerCase().includes(q) ||
      m.ruanganTujuanNama.toLowerCase().includes(q) ||
      m.alasanMutasi.toLowerCase().includes(q)
    );
  });

  const sortedMutasi = sortMutasiList(filteredMutasi, sortBy, sortDir);
  const pagination = paginateItems(sortedMutasi, currentPage, pageSize);

  const handleToggleSort = (key: MutasiSortKey) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'tanggalMutasi' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (key: MutasiSortKey) => {
    if (sortBy !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" />
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedBarangObj) {
      setFormError('Pilih barang yang akan dimutasi.');
      return;
    }

    const tujuanRoom = ruanganList.find((r) => r.id === ruanganTujuanId);
    if (!tujuanRoom) {
      setFormError('Pilih ruangan dan sub-ruangan tujuan yang valid.');
      return;
    }

    const candidate: Partial<Mutasi> = {
      nomorBeritaAcara,
      tanggalMutasi,
      jenisMutasi,
      barangId: selectedBarangObj.id,
      ruanganTujuanId: tujuanRoom.id,
      petugasInput,
      alasanMutasi,
    };

    const validation = validateMutasiInput(candidate);
    if (!validation.valid) {
      setFormError(validation.error || 'Data mutasi belum lengkap.');
      return;
    }

    const originRoom = ruanganList.find(
      (r) => r.id === selectedBarangObj.ruanganId
    );
    const asalFullLabel = formatRuanganFullLabel(
      originRoom,
      selectedBarangObj.ruanganNama
    ).slice(0, 120);
    const tujuanFullLabel = formatRuanganFullLabel(tujuanRoom).slice(0, 120);

    const nowIso = new Date().toISOString();
    const record: Mutasi = {
      id: sanitizeId(`mut-${Date.now()}`),
      nomorBeritaAcara: nomorBeritaAcara.trim(),
      tanggalMutasi: tanggalMutasi.trim(),
      jenisMutasi,
      barangId: selectedBarangObj.id,
      kodeBarang: selectedBarangObj.kodeBarang,
      namaBarang: selectedBarangObj.namaBarang,
      ruanganAsalId: selectedBarangObj.ruanganId,
      ruanganAsalNama: asalFullLabel,
      ruanganTujuanId: tujuanRoom.id,
      ruanganTujuanNama: tujuanFullLabel,
      kondisiAwal: selectedBarangObj.kondisi,
      kondisiAkhir,
      petugasInput: petugasInput.trim(),
      alasanMutasi: alasanMutasi.trim(),
      ownerId: selectedBarangObj.ownerId || 'demo-user',
      createdAt: nowIso,
    };

    try {
      setIsSubmitting(true);
      await onRecordMutasi(record);
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan mutasi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unboxed Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Mutasi Barang &amp; BAST
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Menampilkan{' '}
            <strong className="font-semibold text-stone-900">
              {filteredMutasi.length}
            </strong>{' '}
            dari {mutasiList.length} riwayat perpindahan ruangan &amp; perubahan kondisi barang.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewMutasiModal(null)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Mutasi</span>
        </button>
      </div>

      {/* Structured Filter Bar (Zero Overflow, Senior-Friendly Sizing) */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor BAST, nama barang, ruangan asal atau tujuan..."
              aria-label="Cari riwayat mutasi"
              className="w-full h-11 pl-10 pr-4 text-[15px] text-stone-900 placeholder:text-stone-400 bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
            />
          </div>

          <div
            role="group"
            aria-label="Filter jenis mutasi"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-md shrink-0"
          >
            {(
              [
                'ALL',
                'Perpindahan Ruangan',
                'Perubahan Kondisi',
                'Penempatan Baru',
              ] as const
            ).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setFilterJenis(j)}
                className={`px-3.5 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  filterJenis === j
                    ? 'bg-white text-stone-900 font-semibold shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {j === 'ALL' ? `Semua (${mutasiList.length})` : j}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mutasi Table */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {filteredMutasi.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ArrowRightLeft className="w-8 h-8 text-stone-400 mx-auto" />
            <div className="text-base font-semibold text-stone-900">
              Belum ada riwayat mutasi ditemukan
            </div>
            <p className="text-sm text-stone-600 max-w-md mx-auto">
              Catat perpindahan ruangan atau perubahan keadaan barang untuk menerbitkan Berita Acara Mutasi KIR.
            </p>
            <button
              type="button"
              onClick={() => openNewMutasiModal(null)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Mutasi Pertama</span>
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600">
                    <th className="py-3.5 px-5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('tanggalMutasi')}
                        className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer"
                      >
                        <span>No. BAST &amp; Tanggal</span>
                        {renderSortIcon('tanggalMutasi')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('namaBarang')}
                        className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer"
                      >
                        <span>Barang Inventaris</span>
                        {renderSortIcon('namaBarang')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Jenis Mutasi</th>
                    <th className="py-3.5 px-4">Perpindahan Ruangan</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Keadaan</th>
                    <th className="py-3.5 px-4">Petugas &amp; Alasan</th>
                    <th className="py-3.5 px-5 text-right whitespace-nowrap">Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-sm">
                  {pagination.pageItems.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-4 px-5 whitespace-nowrap align-top">
                      <div className="font-mono text-xs font-semibold text-stone-900">
                        {m.nomorBeritaAcara}
                      </div>
                      <div className="text-xs font-mono text-stone-500 tabular-nums mt-0.5">
                        {m.tanggalMutasi}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="font-semibold text-stone-900">{m.namaBarang}</div>
                      <div className="text-xs font-mono text-stone-500 mt-0.5">
                        {m.kodeBarang}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-stone-800 whitespace-nowrap align-top">
                      {m.jenisMutasi}
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="text-xs text-stone-600">{m.ruanganAsalNama}</div>
                      <div className="font-semibold text-[#0F5C4D] mt-0.5">
                        → {m.ruanganTujuanNama}
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap align-top text-xs">
                      <span className="text-stone-600">{m.kondisiAwal}</span>
                      <span className="mx-1.5 text-stone-400">→</span>
                      <strong className="text-stone-900 font-semibold">{m.kondisiAkhir}</strong>
                    </td>
                    <td className="py-4 px-4 max-w-xs align-top">
                      <div className="text-stone-800 font-medium">{m.petugasInput}</div>
                      <div className="text-xs text-stone-500 line-clamp-2 mt-0.5">
                        {m.alasanMutasi}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap align-top">
                      <button
                        type="button"
                        onClick={() => setSelectedBast(m)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#0F5C4D] bg-[#EBF4F2] border border-[#C7DFD9] rounded-md hover:bg-[#DCECE8] transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Lihat BAST</span>
                      </button>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>

            <TablePagination
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
              itemLabel="riwayat mutasi"
            />
          </>
        )}
      </div>

      {/* Modal Catat Mutasi Baru */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-mutasi-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-xl w-full p-6 space-y-5 shadow-lg my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2 id="modal-mutasi-title" className="text-base font-bold text-stone-900">
                Catat Mutasi Barang Inventaris (BAST)
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup form mutasi"
                className="p-1 text-slate-400 hover:text-stone-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="input-no-ba" className="block text-xs font-semibold text-stone-700 mb-1">
                    Nomor Berita Acara (BAST) *
                  </label>
                  <input
                    id="input-no-ba"
                    type="text"
                    required
                    value={nomorBeritaAcara}
                    onChange={(e) => setNomorBeritaAcara(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div>
                  <label htmlFor="input-tgl-mutasi" className="block text-xs font-semibold text-stone-700 mb-1">
                    Tanggal Efektif Mutasi *
                  </label>
                  <input
                    id="input-tgl-mutasi"
                    type="date"
                    required
                    value={tanggalMutasi}
                    onChange={(e) => setTanggalMutasi(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="input-jenis-mutasi" className="block text-xs font-semibold text-stone-700 mb-1">
                    Jenis Mutasi *
                  </label>
                  <select
                    id="input-jenis-mutasi"
                    value={jenisMutasi}
                    onChange={(e) => setJenisMutasi(e.target.value as JenisMutasi)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  >
                    <option value="Perpindahan Ruangan">Perpindahan Ruangan</option>
                    <option value="Perubahan Kondisi">Perubahan Kondisi</option>
                    <option value="Penempatan Baru">Penempatan Baru</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="input-petugas-mutasi" className="block text-xs font-semibold text-stone-700 mb-1">
                    Petugas Pengurus Barang *
                  </label>
                  <input
                    id="input-petugas-mutasi"
                    type="text"
                    required
                    value={petugasInput}
                    onChange={(e) => setPetugasInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              </div>

              {/* Tahap 1: Pilih Ruangan Asal dulu, lalu Barang yang ada di Sub-Ruangan tersebut */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-3.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-stone-600">
                  Lokasi Asal &amp; Barang yang Dimutasi
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="input-asal-ruangan-induk"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      1. Ruangan Induk Asal *
                    </label>
                    <select
                      id="input-asal-ruangan-induk"
                      required
                      value={asalParentName}
                      onChange={(e) => handleChangeAsalParent(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {parentRuanganNames.map((parent) => {
                        const subIds = new Set(
                          getSubRuanganByParent(ruanganList, parent).map(
                            (r) => r.id
                          )
                        );
                        const count = barangList.filter((b) =>
                          subIds.has(b.ruanganId)
                        ).length;
                        return (
                          <option key={parent} value={parent}>
                            {parent} ({count} barang)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="input-asal-sub-ruangan"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      2. Sub-Ruangan Asal *
                    </label>
                    <select
                      id="input-asal-sub-ruangan"
                      required
                      value={asalRuanganId}
                      onChange={(e) =>
                        handleChangeAsalSubRuangan(e.target.value)
                      }
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {asalSubOptions.map((r) => {
                        const count = barangList.filter(
                          (b) => b.ruanganId === r.id
                        ).length;
                        return (
                          <option key={r.id} value={r.id}>
                            {r.subRuangan || r.namaRuangan} [{r.kodeRuangan}] ·{' '}
                            {count} barang
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="input-pilih-barang"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    3. Pilih Barang di Sub-Ruangan Ini *
                  </label>
                  {barangInAsalRoom.length === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      Belum ada barang terdaftar di sub-ruangan ini. Pilih ruangan atau sub-ruangan asal lain yang memiliki barang.
                    </div>
                  ) : (
                    <select
                      id="input-pilih-barang"
                      required
                      value={barangId}
                      onChange={(e) => {
                        const bId = e.target.value;
                        setBarangId(bId);
                        const bObj = barangList.find((x) => x.id === bId);
                        if (bObj) {
                          setKondisiAkhir(bObj.kondisi);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {barangInAsalRoom.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.namaBarang}
                          {b.merkTipe ? ` — ${b.merkTipe}` : ''} ({b.kondisi} · {b.jumlah} {b.satuan})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedBarangObj && (
                  <div className="pt-2 border-t border-stone-200/80 text-[11px] flex flex-wrap items-center justify-between gap-2 text-stone-600">
                    <div>
                      <span>Lokasi Asal: </span>
                      <strong className="text-stone-900">
                        {selectedBarangRoomInfo?.fullLabel ||
                          selectedBarangObj.ruanganNama}
                      </strong>
                    </div>
                    <div>
                      <span>Keadaan Saat Ini: </span>
                      <strong className="text-stone-900">
                        {selectedBarangObj.kondisi}
                      </strong>
                      <span> · {selectedBarangObj.jumlah} {selectedBarangObj.satuan}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tahap 2: Lokasi Tujuan & Keadaan Akhir */}
              <div className="p-4 bg-[#EBF4F2]/60 border border-[#C7DFD9] rounded-lg space-y-3.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#0B463B]">
                  Lokasi Tujuan &amp; Kondisi Akhir
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="input-tujuan-ruangan-induk"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      1. Ruangan Induk Tujuan *
                    </label>
                    <select
                      id="input-tujuan-ruangan-induk"
                      required
                      value={tujuanParentName}
                      onChange={(e) => handleChangeTujuanParent(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {parentRuanganNames.map((parent) => (
                        <option key={parent} value={parent}>
                          {parent}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="input-ruangan-tujuan"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      2. Sub-Ruangan Tujuan *
                    </label>
                    <select
                      id="input-ruangan-tujuan"
                      required
                      value={ruanganTujuanId}
                      onChange={(e) => setRuanganTujuanId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {tujuanSubOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.subRuangan || r.namaRuangan} [{r.kodeRuangan}]
                          {r.id === asalRuanganId ? ' (Lokasi saat ini)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="input-kondisi-akhir"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Keadaan Barang Setelah Mutasi *
                  </label>
                  <select
                    id="input-kondisi-akhir"
                    value={kondisiAkhir}
                    onChange={(e) =>
                      setKondisiAkhir(e.target.value as KondisiBarang)
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  >
                    {KONDISI_LIST.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="input-alasan-mutasi" className="block text-xs font-semibold text-stone-700 mb-1">
                  Dasar / Alasan Mutasi Barang *
                </label>
                <textarea
                  id="input-alasan-mutasi"
                  rows={2}
                  required
                  value={alasanMutasi}
                  onChange={(e) => setAlasanMutasi(e.target.value)}
                  placeholder="Contoh: Relokasi perangkat sesuai nota dinas kebutuhan instalasi..."
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || barangInAsalRoom.length === 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5C4D] rounded-lg hover:bg-[#0B463B] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan & Proses Mutasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview & Cetak Berita Acara Serah Terima (BAST) */}
      {selectedBast && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-2xl w-full p-6 space-y-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 no-print">
              <h2 className="text-base font-bold text-stone-900">
                Berita Acara Mutasi Inventaris Ruangan
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak BAST</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBast(null)}
                  aria-label="Tutup BAST"
                  className="p-1 text-slate-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 border border-stone-300 rounded-lg space-y-5 text-xs text-stone-800">
              <div className="text-center border-b-2 border-slate-900 pb-3 space-y-0.5">
                <div className="text-xs font-semibold text-stone-600">
                  PEMERINTAH {instansi.propinsi} — {instansi.kotaKab}
                </div>
                <div className="text-sm font-bold text-stone-900">
                  {instansi.unit}
                </div>
                <div className="text-[11px] font-mono text-stone-500">
                  NO. KODE LOKASI: {instansi.kodeLokasi}
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="text-sm font-bold underline">
                  BERITA ACARA MUTASI INVENTARIS RUANGAN (KIR)
                </div>
                <div className="font-mono text-xs">
                  Nomor: {selectedBast.nomorBeritaAcara}
                </div>
              </div>

              <p className="leading-relaxed">
                Pada tanggal <strong className="font-mono">{selectedBast.tanggalMutasi}</strong>, telah dilaksanakan pencatatan{' '}
                <strong>{selectedBast.jenisMutasi}</strong> atas Barang Inventaris pada Kartu Inventaris Ruangan (KIR) dengan rincian sebagai berikut:
              </p>

              <div className="border border-stone-200 rounded-lg divide-y divide-stone-200">
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-stone-500">Nama & Kode Barang</span>
                  <span className="col-span-2 font-semibold text-stone-900">
                    {selectedBast.namaBarang} ({selectedBast.kodeBarang})
                  </span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-stone-500">Ruangan Asal</span>
                  <span className="col-span-2">{selectedBast.ruanganAsalNama}</span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-stone-500">Ruangan Tujuan</span>
                  <span className="col-span-2 font-semibold text-stone-900">
                    {selectedBast.ruanganTujuanNama}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-stone-500">Status Keadaan Fisik</span>
                  <span className="col-span-2">
                    {selectedBast.kondisiAwal} → <strong>{selectedBast.kondisiAkhir}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-3 p-2.5">
                  <span className="text-stone-500">Keterangan / Dasar</span>
                  <span className="col-span-2">{selectedBast.alasanMutasi}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 text-center">
                <div className="space-y-12">
                  <div>
                    <div className="text-stone-500">Mengetahui,</div>
                    <div className="font-semibold">Direktur</div>
                  </div>
                  <div>
                    <div className="font-bold underline">{instansi.namaKepalaUnit}</div>
                    <div className="font-mono text-[11px]">NIP. {instansi.nipKepalaUnit}</div>
                  </div>
                </div>
                <div className="space-y-12">
                  <div>
                    <div className="text-stone-500">{instansi.kotaKab}, {selectedBast.tanggalMutasi}</div>
                    <div className="font-semibold">Pengurus Barang</div>
                  </div>
                  <div>
                    <div className="font-bold underline">{selectedBast.petugasInput}</div>
                    <div className="font-mono text-[11px]">NIP. {instansi.nipPengurusBarang}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
