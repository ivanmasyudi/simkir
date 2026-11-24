import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Edit3,
  Package,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  Barang,
  InstansiSetting,
  KategoriBarang,
  KondisiBarang,
  MasterReferensi,
  Ruangan,
} from '../types/kir';
import {
  buildBarangRecordsFromConditionBreakdown,
  buildQrPayload,
  filterBarangList,
  formatRuanganFullLabel,
  getSubRuanganByParent,
  getUniqueParentRuanganNames,
  KATEGORI_LIST,
  KONDISI_LIST,
  planBarangEditFromBreakdown,
  resolveBarangRoom,
  validateBarangInput,
} from '../utils/kirLogic';
import {
  CUSTOM_MANUAL_OPTION_VALUE,
  findMatchingMasterValue,
  getEffectiveMasterOptions,
} from '../utils/masterReferensi';
import { QrCodeSvg } from './QrCodeSvg';
import { TablePagination } from './TablePagination';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  BarangSortKey,
  paginateItems,
  sortBarangList,
  SortDirection,
} from '../utils/tablePagination';

interface MasterBarangViewProps {
  barangList: Barang[];
  ruanganList: Ruangan[];
  instansi: InstansiSetting;
  masterReferensiList?: MasterReferensi[];
  initialFilterRuanganId?: string;
  triggerOpenAddModal?: number;
  onSaveBarang: (barang: Barang, isEdit: boolean) => Promise<void>;
  onSaveBarangBatch?: (records: Barang[]) => Promise<void>;
  onDeleteBarang: (id: string) => Promise<void>;
  onOpenMutasiForBarang: (barang: Barang) => void;
}

export const MasterBarangView: React.FC<MasterBarangViewProps> = ({
  barangList,
  ruanganList,
  instansi,
  masterReferensiList = [],
  initialFilterRuanganId = 'ALL',
  triggerOpenAddModal = 0,
  onSaveBarang,
  onSaveBarangBatch,
  onDeleteBarang,
  onOpenMutasiForBarang,
}) => {
  const [search, setSearch] = useState('');
  const [filterParentRuangan, setFilterParentRuangan] = useState('ALL');
  const [filterRuangan, setFilterRuangan] = useState(initialFilterRuanganId);
  const [filterKategori, setFilterKategori] = useState('ALL');
  const [filterKondisi, setFilterKondisi] = useState('ALL');
  const [sortBy, setSortBy] = useState<BarangSortKey>('default');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarang, setEditingBarang] = useState<Barang | null>(null);
  const [detailBarang, setDetailBarang] = useState<Barang | null>(null);
  const [deleteTargetBarang, setDeleteTargetBarang] = useState<Barang | null>(
    null
  );
  const [isDeletingBarang, setIsDeletingBarang] = useState(false);
  const [deleteBarangError, setDeleteBarangError] = useState<string | null>(
    null
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified Add & Edit form fields (aligned with KIR 13 columns + cascading Ruangan Induk -> Sub-Ruangan)
  const [selectedKatalogId, setSelectedKatalogId] = useState('');
  const [kodeBarang, setKodeBarang] = useState('');
  const [nup, setNup] = useState('');
  const [namaBarang, setNamaBarang] = useState('');
  const [merkTipe, setMerkTipe] = useState('');
  const [isManualMerk, setIsManualMerk] = useState(false);
  const [nomorSeri, setNomorSeri] = useState('');
  const [ukuran, setUkuran] = useState('');
  const [isManualUkuran, setIsManualUkuran] = useState(false);
  const [bahan, setBahan] = useState('BESI');
  const [isManualBahan, setIsManualBahan] = useState(false);
  const [kategori, setKategori] = useState<KategoriBarang>('Perlengkapan Kantor');
  const [tahunPerolehan, setTahunPerolehan] = useState(2024);
  const [sumberDana, setSumberDana] = useState('BLUD');
  const [qtyBaik, setQtyBaik] = useState(1);
  const [qtyKurangBaik, setQtyKurangBaik] = useState(0);
  const [qtyRusakBerat, setQtyRusakBerat] = useState(0);
  const [satuan, setSatuan] = useState('UNIT');
  const [isManualSatuan, setIsManualSatuan] = useState(false);
  const [formParentRuangan, setFormParentRuangan] = useState('');
  const [ruanganId, setRuanganId] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Effective Master Referensi options for dropdowns
  const satuanOptions = getEffectiveMasterOptions(masterReferensiList, 'satuan');
  const bahanOptions = getEffectiveMasterOptions(masterReferensiList, 'bahan');
  const ukuranOptions = getEffectiveMasterOptions(masterReferensiList, 'ukuran');
  const merkOptions = getEffectiveMasterOptions(masterReferensiList, 'merk');
  const katalogOptions = getEffectiveMasterOptions(masterReferensiList, 'katalog');

  const parentRuanganNames = getUniqueParentRuanganNames(ruanganList);
  const filterSubRuanganOptions =
    filterParentRuangan === 'ALL'
      ? ruanganList
      : getSubRuanganByParent(ruanganList, filterParentRuangan);
  const formSubRuanganOptions = getSubRuanganByParent(
    ruanganList,
    formParentRuangan
  );

  useEffect(() => {
    if (initialFilterRuanganId && initialFilterRuanganId !== 'ALL') {
      const target = ruanganList.find((r) => r.id === initialFilterRuanganId);
      if (target) {
        setFilterParentRuangan(target.namaRuangan);
        setFilterRuangan(target.id);
      } else {
        setFilterParentRuangan('ALL');
        setFilterRuangan('ALL');
      }
    } else {
      setFilterParentRuangan('ALL');
      setFilterRuangan('ALL');
    }
  }, [initialFilterRuanganId, ruanganList]);

  useEffect(() => {
    if (triggerOpenAddModal > 0) {
      openAddModal();
    }
  }, [triggerOpenAddModal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    filterParentRuangan,
    filterRuangan,
    filterKategori,
    filterKondisi,
    sortBy,
    sortDir,
  ]);

  const filteredList = filterBarangList(barangList, {
    search,
    parentRuanganName: filterParentRuangan,
    ruanganId: filterRuangan,
    kategori: filterKategori,
    kondisi: filterKondisi,
    ruanganList,
  });

  const sortedList = sortBarangList(filteredList, sortBy, sortDir, ruanganList);
  const pagination = paginateItems(sortedList, currentPage, pageSize);

  const handleToggleSort = (key: Exclude<BarangSortKey, 'default'>) => {
    if (sortBy === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortBy('default');
        setSortDir('asc');
      }
    } else {
      setSortBy(key);
      setSortDir(key === 'jumlah' || key === 'tahunPerolehan' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (key: Exclude<BarangSortKey, 'default'>) => {
    if (sortBy !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#0F5C4D] shrink-0" />
    );
  };

  const openAddModal = () => {
    setEditingBarang(null);
    setSelectedKatalogId('');
    const nextNum = String(barangList.length + 1).padStart(4, '0');
    setKodeBarang(
      `1.3.2.05.02.01.${String(barangList.length + 1).padStart(3, '0')}`
    );
    setNup(nextNum);
    setNamaBarang('');
    setMerkTipe('');
    setIsManualMerk(false);
    setNomorSeri('');
    setUkuran('');
    setIsManualUkuran(false);
    const defaultBahan =
      findMatchingMasterValue('BESI', bahanOptions) ||
      bahanOptions[0]?.nama ||
      'BESI';
    setBahan(defaultBahan);
    setIsManualBahan(false);
    setKategori('Perlengkapan Kantor');
    setTahunPerolehan(2024);
    setSumberDana('BLUD');
    setQtyBaik(1);
    setQtyKurangBaik(0);
    setQtyRusakBerat(0);
    const defaultSatuan =
      findMatchingMasterValue('UNIT', satuanOptions) ||
      satuanOptions[0]?.nama ||
      'UNIT';
    setSatuan(defaultSatuan);
    setIsManualSatuan(false);

    const defaultRoom =
      (filterRuangan !== 'ALL'
        ? ruanganList.find((r) => r.id === filterRuangan)
        : null) ||
      (filterParentRuangan !== 'ALL'
        ? getSubRuanganByParent(ruanganList, filterParentRuangan)[0]
        : null) ||
      ruanganList[0];

    setFormParentRuangan(defaultRoom?.namaRuangan || '');
    setRuanganId(defaultRoom?.id || '');
    setKeterangan('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (b: Barang) => {
    setEditingBarang(b);

    const matchedKatalog = katalogOptions.find(
      (k) =>
        k.kode.trim().toLowerCase() === b.kodeBarang.trim().toLowerCase() &&
        k.nama.trim().toLowerCase() === b.namaBarang.trim().toLowerCase()
    );
    setSelectedKatalogId(matchedKatalog?.id || '');

    setKodeBarang(b.kodeBarang);
    setNup(b.nup);
    setNamaBarang(b.namaBarang);

    const matchedMerk = findMatchingMasterValue(b.merkTipe || '', merkOptions);
    if ((b.merkTipe || '').trim() && !matchedMerk) {
      setMerkTipe(b.merkTipe);
      setIsManualMerk(true);
    } else {
      setMerkTipe(matchedMerk || '');
      setIsManualMerk(false);
    }

    setNomorSeri(b.nomorSeri || '');

    const matchedUkuran = findMatchingMasterValue(b.ukuran || '', ukuranOptions);
    if ((b.ukuran || '').trim() && !matchedUkuran) {
      setUkuran(b.ukuran);
      setIsManualUkuran(true);
    } else {
      setUkuran(matchedUkuran || '');
      setIsManualUkuran(false);
    }

    const rawBahan = b.bahan || 'BESI';
    const matchedBahan = findMatchingMasterValue(rawBahan, bahanOptions);
    if (matchedBahan) {
      setBahan(matchedBahan);
      setIsManualBahan(false);
    } else {
      setBahan(rawBahan);
      setIsManualBahan(true);
    }

    setKategori(b.kategori);
    setTahunPerolehan(b.tahunPerolehan);
    setSumberDana(b.sumberDana);

    // Unified 3-condition breakdown initialized from existing record
    setQtyBaik(b.kondisi === 'Baik' ? b.jumlah : 0);
    setQtyKurangBaik(b.kondisi === 'Kurang Baik' ? b.jumlah : 0);
    setQtyRusakBerat(b.kondisi === 'Rusak Berat' ? b.jumlah : 0);

    const rawSatuan = (b.satuan || 'UNIT').toUpperCase();
    const matchedSatuan = findMatchingMasterValue(rawSatuan, satuanOptions);
    if (matchedSatuan) {
      setSatuan(matchedSatuan);
      setIsManualSatuan(false);
    } else {
      setSatuan(rawSatuan);
      setIsManualSatuan(true);
    }

    const matchedRoom = ruanganList.find((r) => r.id === b.ruanganId);
    setFormParentRuangan(
      matchedRoom?.namaRuangan || parentRuanganNames[0] || ''
    );
    setRuanganId(matchedRoom?.id || b.ruanganId);
    setKeterangan(b.keterangan);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSelectKatalog = (katalogId: string) => {
    setSelectedKatalogId(katalogId);
    if (!katalogId) return;
    const found = katalogOptions.find((item) => item.id === katalogId);
    if (found) {
      setNamaBarang(found.nama);
      if (found.kode) {
        setKodeBarang(found.kode);
      }
    }
  };

  const handleParentChangeInForm = (nextParent: string) => {
    setFormParentRuangan(nextParent);
    const subs = getSubRuanganByParent(ruanganList, nextParent);
    setRuanganId(subs[0]?.id || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const selectedRoom = ruanganList.find((r) => r.id === ruanganId);
    if (!selectedRoom) {
      setFormError('Pilih Ruangan Induk dan Sub-Ruangan penempatan terlebih dahulu.');
      return;
    }

    const totalBreakdownQty =
      (Number(qtyBaik) || 0) +
      (Number(qtyKurangBaik) || 0) +
      (Number(qtyRusakBerat) || 0);

    if (
      qtyBaik < 0 ||
      qtyKurangBaik < 0 ||
      qtyRusakBerat < 0 ||
      totalBreakdownQty < 1
    ) {
      setFormError(
        'Masukkan minimal 1 unit pada kondisi Baik, Kurang Baik, atau Rusak Berat.'
      );
      return;
    }

    const fullRoomName = formatRuanganFullLabel(selectedRoom).slice(0, 120);
    const nowIso = new Date().toISOString();

    if (editingBarang) {
      const baseEditPayload: Omit<
        Barang,
        'id' | 'jumlah' | 'kondisi' | 'nup' | 'ownerId' | 'createdAt'
      > = {
        kodeBarang: kodeBarang.trim(),
        namaBarang: namaBarang.trim(),
        merkTipe: merkTipe.trim(),
        nomorSeri: nomorSeri.trim(),
        ukuran: ukuran.trim(),
        bahan: bahan.trim(),
        kategori,
        tahunPerolehan: Number(tahunPerolehan),
        sumberDana: sumberDana.trim(),
        satuan: satuan.trim().toUpperCase(),
        ruanganId,
        ruanganNama: fullRoomName,
        keterangan: keterangan.trim(),
        updatedAt: nowIso,
      };

      const plan = planBarangEditFromBreakdown(editingBarang, baseEditPayload, {
        baik: qtyBaik,
        kurangBaik: qtyKurangBaik,
        rusakBerat: qtyRusakBerat,
      });

      if (!plan) {
        setFormError(
          'Masukkan minimal 1 unit pada kondisi Baik, Kurang Baik, atau Rusak Berat.'
        );
        return;
      }

      const allToValidate = [plan.updatedRecord, ...plan.createdRecords];
      for (const rec of allToValidate) {
        const validation = validateBarangInput(rec);
        if (!validation.valid) {
          setFormError(validation.error || 'Periksa kembali isian barang.');
          return;
        }
      }

      try {
        setIsSubmitting(true);
        await onSaveBarang(plan.updatedRecord, true);
        if (plan.createdRecords.length > 0) {
          if (onSaveBarangBatch) {
            await onSaveBarangBatch(plan.createdRecords);
          } else {
            for (const rec of plan.createdRecords) {
              await onSaveBarang(rec, false);
            }
          }
        }
        setIsModalOpen(false);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'Gagal menyimpan perubahan barang.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Add mode: build 1 record per non-zero condition
    const basePayload: Omit<Barang, 'id' | 'jumlah' | 'kondisi' | 'nup'> = {
      kodeBarang: kodeBarang.trim(),
      namaBarang: namaBarang.trim(),
      merkTipe: merkTipe.trim(),
      nomorSeri: nomorSeri.trim(),
      ukuran: ukuran.trim(),
      bahan: bahan.trim(),
      kategori,
      tahunPerolehan: Number(tahunPerolehan),
      sumberDana: sumberDana.trim(),
      satuan: satuan.trim().toUpperCase(),
      ruanganId,
      ruanganNama: fullRoomName,
      keterangan: keterangan.trim(),
      ownerId: 'demo-user',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const records = buildBarangRecordsFromConditionBreakdown(
      basePayload,
      nup.trim(),
      {
        baik: qtyBaik,
        kurangBaik: qtyKurangBaik,
        rusakBerat: qtyRusakBerat,
      }
    );

    for (const rec of records) {
      const validation = validateBarangInput(rec);
      if (!validation.valid) {
        setFormError(validation.error || 'Periksa kembali isian barang.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      if (records.length > 1 && onSaveBarangBatch) {
        await onSaveBarangBatch(records);
      } else {
        for (const rec of records) {
          await onSaveBarang(rec, false);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan data barang.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderKondisiIndicator = (k: KondisiBarang) => {
    if (k === 'Baik') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Baik</span>
        </span>
      );
    }
    if (k === 'Kurang Baik') {
      return (
        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Kurang Baik</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-red-700 font-medium">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Rusak Berat</span>
      </span>
    );
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    filterParentRuangan !== 'ALL' ||
    filterRuangan !== 'ALL' ||
    filterKategori !== 'ALL' ||
    filterKondisi !== 'ALL';

  const totalFilteredUnits = filteredList.reduce(
    (acc, item) => acc + (Number(item.jumlah) || 0),
    0
  );

  const handleResetFilters = () => {
    setSearch('');
    setFilterParentRuangan('ALL');
    setFilterRuangan('ALL');
    setFilterKategori('ALL');
    setFilterKondisi('ALL');
    setSortBy('default');
    setSortDir('asc');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Unboxed Clean Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Data Barang Inventaris
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Menampilkan{' '}
            <strong className="font-semibold text-stone-900">
              {filteredList.length}
            </strong>{' '}
            dari {barangList.length} jenis barang ({totalFilteredUnits} unit)
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Barang</span>
        </button>
      </div>

      {/* Structured 2-Row Filter Bar (Zero Overflow, Senior-Friendly Sizing) */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5 space-y-4">
        {/* Row 1: Wide Search + Non-Overflowing Kondisi Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama barang, kode, merk, no. seri, atau ruangan..."
              aria-label="Cari barang inventaris"
              className="w-full h-11 pl-10 pr-4 text-[15px] text-stone-900 placeholder:text-stone-400 bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
            />
          </div>

          <div
            role="group"
            aria-label="Filter kondisi barang"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-md shrink-0"
          >
            {(['ALL', ...KONDISI_LIST] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilterKondisi(k)}
                className={`px-3.5 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  filterKondisi === k
                    ? 'bg-white text-stone-900 font-semibold shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {k === 'ALL' ? 'Semua Kondisi' : k}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: 3 Clean Labeled Dropdowns + Reset */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-stone-200">
          <div>
            <label
              htmlFor="filter-parent-ruangan"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              Ruangan Induk
            </label>
            <select
              id="filter-parent-ruangan"
              aria-label="Filter berdasarkan ruangan induk"
              value={filterParentRuangan}
              onChange={(e) => {
                setFilterParentRuangan(e.target.value);
                setFilterRuangan('ALL');
              }}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="ALL">
                Semua Ruangan Induk ({parentRuanganNames.length})
              </option>
              {parentRuanganNames.map((pName) => (
                <option key={pName} value={pName}>
                  {pName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="filter-sub-ruangan"
              className="block text-xs font-semibold text-stone-600 mb-1"
            >
              Sub-Ruangan
            </label>
            <select
              id="filter-sub-ruangan"
              aria-label="Filter berdasarkan sub-ruangan"
              value={filterRuangan}
              onChange={(e) => setFilterRuangan(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="ALL">
                {filterParentRuangan === 'ALL'
                  ? `Semua Sub-Ruangan (${ruanganList.length})`
                  : `Semua Sub-Ruang di ${filterParentRuangan} (${filterSubRuanganOptions.length})`}
              </option>
              {filterSubRuanganOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {filterParentRuangan === 'ALL'
                    ? formatRuanganFullLabel(r)
                    : r.subRuangan || `${r.namaRuangan} (Utama)`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="filter-kategori-aset"
                className="block text-xs font-semibold text-stone-600"
              >
                Kategori Aset
              </label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-[#0F5C4D] hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
            <select
              id="filter-kategori-aset"
              aria-label="Filter berdasarkan kategori"
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="w-full h-10 px-3 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            >
              <option value="ALL">Semua Kategori Aset</option>
              {KATEGORI_LIST.map((kat) => (
                <option key={kat} value={kat}>
                  {kat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scannable, Zero-Clipping 7-Column Data Table */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-8 h-8 text-stone-400 mx-auto" />
            <div className="text-base font-semibold text-stone-900">
              Belum ada barang inventaris yang sesuai filter
            </div>
            <p className="text-sm text-stone-600 max-w-md mx-auto">
              Ubah pilihan filter di atas atau tambahkan data barang inventaris baru.
            </p>
            <div className="flex items-center justify-center gap-3 pt-1">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Barang</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-sm font-semibold text-stone-700">
                    <th className="py-3.5 px-4 w-12">No</th>
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('namaBarang')}
                        className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer"
                      >
                        <span>Barang &amp; Spesifikasi</span>
                        {renderSortIcon('namaBarang')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('tahunPerolehan')}
                        className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer"
                      >
                        <span>Kode Barang &amp; Tahun</span>
                        {renderSortIcon('tahunPerolehan')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('ruangan')}
                        className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer"
                      >
                        <span>Lokasi Ruangan</span>
                        {renderSortIcon('ruangan')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('jumlah')}
                        className="inline-flex items-center justify-end gap-1.5 ml-auto hover:text-stone-900 cursor-pointer"
                      >
                        <span>Jumlah</span>
                        {renderSortIcon('jumlah')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort('kondisi')}
                        className="inline-flex items-center gap-1.5 hover:text-stone-900 cursor-pointer"
                      >
                        <span>Kondisi</span>
                        {renderSortIcon('kondisi')}
                      </button>
                    </th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-sm">
                  {pagination.pageItems.map((item, idx) => {
                    const roomInfo = resolveBarangRoom(item, ruanganList);
                    const specParts = [
                      item.merkTipe?.trim(),
                      item.ukuran?.trim() ? `Uk. ${item.ukuran.trim()}` : '',
                      item.bahan?.trim(),
                      item.nomorSeri?.trim() ? `SN: ${item.nomorSeri.trim()}` : '',
                    ].filter(Boolean);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-stone-50/80 transition-colors align-top"
                      >
                        <td className="py-4 px-4 font-mono text-stone-500 tabular-nums">
                          {pagination.startIndex + idx + 1}
                        </td>
                      <td className="py-4 px-4 min-w-[240px]">
                        <div className="text-[15px] font-semibold text-stone-900 leading-snug">
                          {item.namaBarang}
                        </div>
                        {specParts.length > 0 && (
                          <div className="text-sm text-stone-600 mt-1">
                            {specParts.join(' · ')}
                          </div>
                        )}
                        <div className="text-xs text-stone-500 mt-1">
                          {item.kategori}
                        </div>
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-stone-900">
                          {item.kodeBarang}
                        </div>
                        <div className="text-xs font-mono text-stone-500 mt-1 tabular-nums">
                          Tahun {item.tahunPerolehan}
                        </div>
                      </td>
                      <td className="py-4 px-4 min-w-[180px]">
                        <div className="font-semibold text-stone-900">
                          {roomInfo.subName || roomInfo.parentName}
                        </div>
                        {roomInfo.subName && (
                          <div className="text-xs text-stone-500 mt-0.5">
                            {roomInfo.parentName}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums font-semibold text-stone-900 whitespace-nowrap">
                        {item.jumlah} {item.satuan}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        {renderKondisiIndicator(item.kondisi)}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailBarang(item)}
                            aria-label={`Lihat QR dan detail ${item.namaBarang}`}
                            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                            title="Preview QR Code & Detail Barang"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenMutasiForBarang(item)}
                            aria-label={`Mutasi ${item.namaBarang}`}
                            className="p-2 text-[#0F5C4D] hover:bg-[#EBF4F2] rounded-md transition-colors cursor-pointer"
                            title="Mutasi Pindah Sub-Ruangan / Ubah Kondisi"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.namaBarang}`}
                            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                            title="Edit Barang"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteBarangError(null);
                              setDeleteTargetBarang(item);
                            }}
                            aria-label={`Hapus ${item.namaBarang}`}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Hapus Barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              itemLabel="barang"
            />
          </>
        )}
      </div>

      {/* Modal Add / Edit Barang */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-barang-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-lg my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2
                id="modal-barang-title"
                className="text-base font-bold text-stone-900"
              >
                {editingBarang
                  ? 'Edit Data Master Barang KIR'
                  : 'Tambah Master Barang KIR Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup form barang"
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
              {/* Tahap 1 (Paling Atas): Pilih Ruangan Induk -> Sub-Ruangan Penempatan Dulu */}
              <div className="p-4 bg-[#EBF4F2]/70 border border-[#C7DFD9] rounded-lg space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#0B463B]">
                  Tahap 1 — Pilih Lokasi Ruangan Penempatan Barang
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="input-ruangan-induk"
                      className="block text-xs font-semibold text-stone-800 mb-1"
                    >
                      1. Ruangan Induk / Instalasi *
                    </label>
                    <select
                      id="input-ruangan-induk"
                      required
                      value={formParentRuangan}
                      onChange={(e) => handleParentChangeInForm(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {parentRuanganNames.map((pName) => (
                        <option key={pName} value={pName}>
                          {pName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="input-ruangan-penempatan"
                      className="block text-xs font-semibold text-stone-800 mb-1"
                    >
                      2. Sub-Ruangan Penempatan Barang *
                    </label>
                    <select
                      id="input-ruangan-penempatan"
                      required
                      value={ruanganId}
                      onChange={(e) => setRuanganId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {formSubRuanganOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.subRuangan || `${r.namaRuangan} (Utama)`} [{r.kodeRuangan}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Pilihan Cepat dari Master Katalog Barang (Opsional — isi otomatis Nama & Kode) */}
              <div>
                <label
                  htmlFor="input-katalog-barang"
                  className="block text-xs font-semibold text-stone-700 mb-1"
                >
                  Pilih dari Master Katalog Barang (Opsional)
                </label>
                <select
                  id="input-katalog-barang"
                  value={selectedKatalogId}
                  onChange={(e) => handleSelectKatalog(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
                >
                  <option value="">
                    -- Pilih dari Master Katalog untuk isi otomatis Nama &amp; Kode --
                  </option>
                  {katalogOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.kode ? `${item.kode} — ${item.nama}` : item.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahap 2: Identitas Barang (Kolom 2–3) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="input-nama-barang"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Jenis Barang / Nama Barang (Kolom 2) *
                  </label>
                  <input
                    id="input-nama-barang"
                    type="text"
                    required
                    value={namaBarang}
                    onChange={(e) => setNamaBarang(e.target.value)}
                    placeholder="Contoh: PRINTER EPSON / TEMPAT TIDUR PASIEN"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-merk-tipe"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Merk / Model (Kolom 3)
                  </label>
                  <select
                    id="input-merk-tipe"
                    value={isManualMerk ? CUSTOM_MANUAL_OPTION_VALUE : merkTipe}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_MANUAL_OPTION_VALUE) {
                        setIsManualMerk(true);
                        setMerkTipe('');
                      } else {
                        setIsManualMerk(false);
                        setMerkTipe(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  >
                    <option value="">-- Pilih Merk / Kosongkan --</option>
                    {merkOptions.map((opt) => (
                      <option key={opt.id} value={opt.nama}>
                        {opt.nama}
                      </option>
                    ))}
                    <option value={CUSTOM_MANUAL_OPTION_VALUE}>
                      + Ketik manual...
                    </option>
                  </select>
                  {isManualMerk && (
                    <input
                      id="input-merk-tipe-manual"
                      type="text"
                      value={merkTipe}
                      onChange={(e) => setMerkTipe(e.target.value)}
                      placeholder="Ketik Merk / Model lain..."
                      className="mt-1.5 w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                  )}
                </div>
              </div>

              {/* No. Seri Pabrik, Ukuran, Bahan (Kolom 4–6) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-nomor-seri"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    No. Seri Pabrik (Kolom 4)
                  </label>
                  <input
                    id="input-nomor-seri"
                    type="text"
                    value={nomorSeri}
                    onChange={(e) => setNomorSeri(e.target.value)}
                    placeholder="Contoh: DM 750 (Opsional)"
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-ukuran"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Ukuran (Kolom 5)
                  </label>
                  <select
                    id="input-ukuran"
                    value={isManualUkuran ? CUSTOM_MANUAL_OPTION_VALUE : ukuran}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_MANUAL_OPTION_VALUE) {
                        setIsManualUkuran(true);
                        setUkuran('');
                      } else {
                        setIsManualUkuran(false);
                        setUkuran(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  >
                    <option value="">-- Pilih Ukuran / Kosongkan --</option>
                    {ukuranOptions.map((opt) => (
                      <option key={opt.id} value={opt.nama}>
                        {opt.nama}
                      </option>
                    ))}
                    <option value={CUSTOM_MANUAL_OPTION_VALUE}>
                      + Ketik manual...
                    </option>
                  </select>
                  {isManualUkuran && (
                    <input
                      id="input-ukuran-manual"
                      type="text"
                      value={ukuran}
                      onChange={(e) => setUkuran(e.target.value)}
                      placeholder="Contoh: 2 PK / 210x95cm"
                      className="mt-1.5 w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                  )}
                </div>
                <div>
                  <label
                    htmlFor="input-bahan"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Bahan (Kolom 6) *
                  </label>
                  <select
                    id="input-bahan"
                    value={isManualBahan ? CUSTOM_MANUAL_OPTION_VALUE : bahan}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_MANUAL_OPTION_VALUE) {
                        setIsManualBahan(true);
                        setBahan('');
                      } else {
                        setIsManualBahan(false);
                        setBahan(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  >
                    {bahanOptions.map((opt) => (
                      <option key={opt.id} value={opt.nama}>
                        {opt.nama}
                      </option>
                    ))}
                    <option value={CUSTOM_MANUAL_OPTION_VALUE}>
                      + Ketik manual...
                    </option>
                  </select>
                  {isManualBahan && (
                    <input
                      id="input-bahan-manual"
                      type="text"
                      required
                      value={bahan}
                      onChange={(e) => setBahan(e.target.value)}
                      placeholder="Ketik bahan lain..."
                      className="mt-1.5 w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                  )}
                </div>
              </div>

              {/* Tahun Pembuatan/Pembelian & No. Kode Barang (Kolom 7–8) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-tahun"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Tahun Pembelian (Kolom 7) *
                  </label>
                  <input
                    id="input-tahun"
                    type="number"
                    min={1970}
                    max={2100}
                    required
                    value={tahunPerolehan}
                    onChange={(e) => setTahunPerolehan(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="input-kode-barang"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    No. Kode Barang (Kolom 8) *
                  </label>
                  <input
                    id="input-kode-barang"
                    type="text"
                    required
                    value={kodeBarang}
                    onChange={(e) => setKodeBarang(e.target.value)}
                    placeholder="1.3.2.05.02.01.001"
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              </div>

              {/* Rincian Jumlah & Keadaan Barang (Kolom 9–12) — 100% Identik untuk Tambah & Edit */}
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-stone-700">
                    Rincian Jumlah &amp; Keadaan Barang (Kolom 9–12)
                  </div>
                  <div className="text-xs font-mono font-bold text-[#0F5C4D] tabular-nums">
                    Total:{' '}
                    {(Number(qtyBaik) || 0) +
                      (Number(qtyKurangBaik) || 0) +
                      (Number(qtyRusakBerat) || 0)}{' '}
                    {satuan}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label
                      htmlFor="input-qty-baik"
                      className="block text-xs font-semibold text-emerald-700 mb-1"
                    >
                      Baik (Kol. 10)
                    </label>
                    <input
                      id="input-qty-baik"
                      type="number"
                      min={0}
                      value={qtyBaik}
                      onChange={(e) =>
                        setQtyBaik(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="input-qty-kurang-baik"
                      className="block text-xs font-semibold text-amber-700 mb-1"
                    >
                      Kurang Baik (11)
                    </label>
                    <input
                      id="input-qty-kurang-baik"
                      type="number"
                      min={0}
                      value={qtyKurangBaik}
                      onChange={(e) =>
                        setQtyKurangBaik(
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="input-qty-rusak-berat"
                      className="block text-xs font-semibold text-red-700 mb-1"
                    >
                      Rusak Berat (12)
                    </label>
                    <input
                      id="input-qty-rusak-berat"
                      type="number"
                      min={0}
                      value={qtyRusakBerat}
                      onChange={(e) =>
                        setQtyRusakBerat(
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-red-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="input-satuan"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Satuan *
                    </label>
                    <select
                      id="input-satuan"
                      value={isManualSatuan ? CUSTOM_MANUAL_OPTION_VALUE : satuan}
                      onChange={(e) => {
                        if (e.target.value === CUSTOM_MANUAL_OPTION_VALUE) {
                          setIsManualSatuan(true);
                          setSatuan('');
                        } else {
                          setIsManualSatuan(false);
                          setSatuan(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    >
                      {satuanOptions.map((opt) => (
                        <option key={opt.id} value={opt.nama}>
                          {opt.nama}
                        </option>
                      ))}
                      <option value={CUSTOM_MANUAL_OPTION_VALUE}>
                        + Ketik manual...
                      </option>
                    </select>
                    {isManualSatuan && (
                      <input
                        id="input-satuan-manual"
                        type="text"
                        required
                        value={satuan}
                        onChange={(e) => setSatuan(e.target.value.toUpperCase())}
                        placeholder="Ketik satuan..."
                        className="mt-1.5 w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                      />
                    )}
                  </div>
                </div>

                {[qtyBaik, qtyKurangBaik, qtyRusakBerat].filter((n) => n > 0)
                  .length > 1 && (
                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    Barang dengan lebih dari satu kondisi akan otomatis dicatat
                    terpisah per kondisi agar mudah dimutasi dan cetak stiker QR,
                    lalu otomatis digabung menjadi <strong>1 baris rekap</strong>{' '}
                    saat Cetak Laporan KIR &amp; Excel.
                  </p>
                )}
              </div>

              {/* Keterangan */}
              <div>
                <label
                  htmlFor="input-ket-barang"
                  className="block text-xs font-semibold text-stone-700 mb-1"
                >
                  Keterangan / Tautan Dokumen (Kolom 13)
                </label>
                <input
                  id="input-ket-barang"
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Catatan tambahan atau link dokumentasi..."
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
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F5C4D] rounded-lg hover:bg-[#0B463B] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Barang KIR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail & QR Code Modal */}
      {detailBarang && (() => {
        const roomInfo = resolveBarangRoom(detailBarang, ruanganList);
        return (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          >
            <div className="bg-white border border-stone-200 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-lg">
              <div className="flex items-start justify-between border-b border-stone-200 pb-3">
                <div>
                  <div className="text-xs font-mono text-stone-500">
                    {detailBarang.kodeBarang} · Tahun {detailBarang.tahunPerolehan}
                  </div>
                  <h2 className="text-base font-bold text-stone-900">
                    {detailBarang.namaBarang}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailBarang(null)}
                  aria-label="Tutup detail barang"
                  className="p-1 text-slate-400 hover:text-stone-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-stone-50 border border-stone-200 rounded-lg">
                <div className="p-2 bg-white border border-stone-200 rounded-lg shrink-0">
                  <QrCodeSvg
                    value={buildQrPayload(
                      detailBarang,
                      instansi.kodeLokasi,
                      roomInfo.ruangan
                    )}
                    size={112}
                  />
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-stone-900">
                    Label Identitas QR Code Inventaris
                  </div>
                  <div className="text-stone-600">
                    No. Kode Lokasi:{' '}
                    <span className="font-mono">{instansi.kodeLokasi}</span>
                  </div>
                  <div className="text-stone-600">
                    Ruangan Induk:{' '}
                    <strong className="text-stone-900">
                      {roomInfo.parentName}
                    </strong>
                  </div>
                  {roomInfo.subName && (
                    <div className="text-stone-600">
                      Sub-Ruangan:{' '}
                      <strong className="text-[#0B463B]">
                        {roomInfo.subName}
                      </strong>
                    </div>
                  )}
                  <div className="text-stone-600">
                    Merk/Model: {detailBarang.merkTipe || '-'} · Tahun:{' '}
                    {detailBarang.tahunPerolehan}
                  </div>
                  <div className="text-stone-600">
                    Ukuran: <strong>{detailBarang.ukuran || '-'}</strong> ·
                    Bahan: <strong>{detailBarang.bahan}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const b = detailBarang;
                    setDetailBarang(null);
                    onOpenMutasiForBarang(b);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0F5C4D] bg-[#EBF4F2] rounded-lg hover:bg-[#DCECE8] cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Mutasi Barang Ini</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailBarang(null)}
                  className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Konfirmasi Hapus Barang */}
      {(() => {
        const roomInfo = deleteTargetBarang
          ? resolveBarangRoom(deleteTargetBarang, ruanganList)
          : null;
        return (
          <ConfirmDeleteModal
            isOpen={Boolean(deleteTargetBarang)}
            title="Hapus Data Barang?"
            description="Data barang yang dihapus permanen dari database tidak dapat dikembalikan."
            itemName={deleteTargetBarang?.namaBarang || ''}
            details={
              deleteTargetBarang
                ? [
                    { label: 'No. Kode Barang', value: deleteTargetBarang.kodeBarang },
                    {
                      label: 'Lokasi Ruangan',
                      value: roomInfo?.subName
                        ? `${roomInfo.parentName} — ${roomInfo.subName}`
                        : roomInfo?.parentName || '-',
                    },
                    {
                      label: 'Jumlah & Kondisi',
                      value: `${deleteTargetBarang.jumlah} ${deleteTargetBarang.satuan} · ${deleteTargetBarang.kondisi}`,
                    },
                  ]
                : []
            }
            confirmLabel="Ya, Hapus Barang"
            isDeleting={isDeletingBarang}
            errorMessage={deleteBarangError}
            onCancel={() => {
              if (!isDeletingBarang) {
                setDeleteTargetBarang(null);
                setDeleteBarangError(null);
              }
            }}
            onConfirm={async () => {
              if (!deleteTargetBarang) return;
              try {
                setIsDeletingBarang(true);
                setDeleteBarangError(null);
                await onDeleteBarang(deleteTargetBarang.id);
                setDeleteTargetBarang(null);
              } catch (err) {
                setDeleteBarangError(
                  err instanceof Error
                    ? err.message
                    : 'Gagal menghapus data barang. Coba lagi.'
                );
              } finally {
                setIsDeletingBarang(false);
              }
            }}
          />
        );
      })()}
    </div>
  );
};
