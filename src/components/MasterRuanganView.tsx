import React, { useEffect, useState } from 'react';
import {
  Building2,
  CornerDownRight,
  Edit3,
  Eye,
  FileText,
  FolderPlus,
  Lock,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Barang, Ruangan } from '../types/kir';
import {
  generateAutoKodeRuangan,
  generateAutoKodeRuanganBatch,
  getUniqueParentRuanganNames,
  groupRuanganByParent,
  RuanganGroup,
  sanitizeId,
  validateRuanganInput,
} from '../utils/kirLogic';
import { TablePagination } from './TablePagination';
import { paginateItems } from '../utils/tablePagination';

interface MasterRuanganViewProps {
  ruanganList: Ruangan[];
  barangList: Barang[];
  onSaveRuangan: (ruangan: Ruangan, isEdit: boolean) => Promise<void>;
  onSaveRuanganBatch?: (ruanganItems: Ruangan[]) => Promise<void>;
  onDeleteRuangan: (id: string) => Promise<void>;
  onNavigateLaporanRuangan: (ruanganId: string) => void;
  onNavigateQrRuangan: (ruanganId: string) => void;
}

interface SubDraftRow {
  nama: string;
}

export const MasterRuanganView: React.FC<MasterRuanganViewProps> = ({
  ruanganList,
  barangList,
  onSaveRuangan,
  onSaveRuanganBatch,
  onDeleteRuangan,
  onNavigateLaporanRuangan,
  onNavigateQrRuangan,
}) => {
  const [search, setSearch] = useState('');
  const [selectedGedung, setSelectedGedung] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [inspectPage, setInspectPage] = useState(1);
  const [inspectPageSize, setInspectPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'new-parent' | 'add-sub' | 'edit'>(
    'new-parent'
  );
  const [editingRuangan, setEditingRuangan] = useState<Ruangan | null>(null);
  const [inspectRuangan, setInspectRuangan] = useState<Ruangan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [namaRuangan, setNamaRuangan] = useState('');
  const [subRuangan, setSubRuangan] = useState('');
  const [subDrafts, setSubDrafts] = useState<SubDraftRow[]>([{ nama: '' }]);
  const [gedung, setGedung] = useState('');
  const [lantai, setLantai] = useState('');
  const [penanggungJawab, setPenanggungJawab] = useState('');
  const [nipPenanggungJawab, setNipPenanggungJawab] = useState('');
  const [unitKerja, setUnitKerja] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const gedungList = Array.from(new Set(ruanganList.map((r) => r.gedung)));
  const existingParentNames = getUniqueParentRuanganNames(ruanganList);

  // Auto-generated, non-editable room codes
  const autoSubDraftCodes = generateAutoKodeRuanganBatch(
    namaRuangan,
    Math.max(1, subDrafts.length),
    ruanganList
  );
  const resolvedSingleKodeRuangan =
    modalMode === 'edit' && editingRuangan
      ? editingRuangan.kodeRuangan
      : generateAutoKodeRuangan(namaRuangan, ruanganList);

  const filteredRuangan = ruanganList.filter((r) => {
    if (selectedGedung !== 'ALL' && r.gedung !== selectedGedung) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.kodeRuangan.toLowerCase().includes(q) ||
      r.namaRuangan.toLowerCase().includes(q) ||
      (r.subRuangan ?? '').toLowerCase().includes(q) ||
      r.penanggungJawab.toLowerCase().includes(q) ||
      r.unitKerja.toLowerCase().includes(q) ||
      r.gedung.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGedung]);

  useEffect(() => {
    setInspectPage(1);
  }, [inspectRuangan?.id]);

  const groupedRuangan = groupRuanganByParent(filteredRuangan);
  const roomPagination = paginateItems(groupedRuangan, currentPage, pageSize);

  const openAddParentModal = () => {
    setModalMode('new-parent');
    setEditingRuangan(null);
    setNamaRuangan('');
    setSubRuangan('');
    setSubDrafts([{ nama: '' }, { nama: '' }]);
    setGedung('Gedung Rawat Inap Terpadu');
    setLantai('Lantai 2');
    setPenanggungJawab('');
    setNipPenanggungJawab('');
    setUnitKerja('');
    setKeterangan('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openAddSubModal = (group: RuanganGroup) => {
    setModalMode('add-sub');
    setEditingRuangan(null);
    setNamaRuangan(group.parentName);
    setSubRuangan(`${group.parentName} ${group.subRuanganList.length + 1}`);
    setGedung(group.gedung);
    setLantai(group.lantai);
    setPenanggungJawab(group.penanggungJawab);
    setNipPenanggungJawab(group.nipPenanggungJawab);
    setUnitKerja(group.unitKerja);
    setKeterangan('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (r: Ruangan) => {
    setModalMode('edit');
    setEditingRuangan(r);
    setNamaRuangan(r.namaRuangan);
    setSubRuangan(r.subRuangan || '');
    setGedung(r.gedung);
    setLantai(r.lantai);
    setPenanggungJawab(r.penanggungJawab);
    setNipPenanggungJawab(r.nipPenanggungJawab);
    setUnitKerja(r.unitKerja);
    setKeterangan(r.keterangan);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleAddSubDraftRow = () => {
    const nextIdx = subDrafts.length + 1;
    const baseName = namaRuangan.trim();
    setSubDrafts((prev) => [
      ...prev,
      {
        nama: baseName ? `${baseName} ${nextIdx}` : '',
      },
    ]);
  };

  const handleUpdateSubDraft = (idx: number, val: string) => {
    setSubDrafts((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, nama: val } : row))
    );
  };

  const handleRemoveSubDraft = (idx: number) => {
    setSubDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const nowIso = new Date().toISOString();

    if (modalMode === 'new-parent') {
      const filledSubDrafts = subDrafts.filter((d) => d.nama.trim().length > 0);
      const rowsToCreate: SubDraftRow[] =
        filledSubDrafts.length > 0 ? filledSubDrafts : [{ nama: '' }];

      const batchCodes = generateAutoKodeRuanganBatch(
        namaRuangan.trim(),
        rowsToCreate.length,
        ruanganList
      );

      const records: Ruangan[] = [];
      for (let i = 0; i < rowsToCreate.length; i++) {
        const row = rowsToCreate[i];
        const finalKode = batchCodes[i];
        const candidate: Partial<Ruangan> = {
          kodeRuangan: finalKode,
          namaRuangan: namaRuangan.trim(),
          subRuangan: row.nama.trim(),
          gedung: gedung.trim(),
          lantai: lantai.trim(),
          penanggungJawab: penanggungJawab.trim(),
          nipPenanggungJawab: nipPenanggungJawab.trim(),
          unitKerja: unitKerja.trim(),
          keterangan: keterangan.trim(),
        };
        const validation = validateRuanganInput(candidate);
        if (!validation.valid) {
          setFormError(
            `Sub-ruangan #${i + 1}: ${validation.error || 'Data belum lengkap.'}`
          );
          return;
        }
        records.push({
          id: sanitizeId(
            `ruang-${finalKode.toLowerCase()}-${Date.now().toString().slice(-4)}-${i}`
          ),
          kodeRuangan: finalKode,
          namaRuangan: namaRuangan.trim(),
          subRuangan: row.nama.trim(),
          gedung: gedung.trim(),
          lantai: lantai.trim(),
          penanggungJawab: penanggungJawab.trim(),
          nipPenanggungJawab: nipPenanggungJawab.trim(),
          unitKerja: unitKerja.trim(),
          keterangan: keterangan.trim(),
          ownerId: 'demo-user',
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      try {
        setIsSubmitting(true);
        if (onSaveRuanganBatch) {
          await onSaveRuanganBatch(records);
        } else {
          for (const rec of records) {
            await onSaveRuangan(rec, false);
          }
        }
        setIsModalOpen(false);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'Gagal menyimpan ruangan.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Single sub-ruangan create or edit — kodeRuangan is always system-controlled
    const lockedKode =
      modalMode === 'edit' && editingRuangan
        ? editingRuangan.kodeRuangan
        : generateAutoKodeRuangan(namaRuangan.trim(), ruanganList);

    const candidate: Partial<Ruangan> = {
      kodeRuangan: lockedKode,
      namaRuangan,
      subRuangan,
      gedung,
      lantai,
      penanggungJawab,
      nipPenanggungJawab,
      unitKerja,
      keterangan,
    };

    const validation = validateRuanganInput(candidate);
    if (!validation.valid) {
      setFormError(validation.error || 'Data ruangan belum lengkap.');
      return;
    }

    const record: Ruangan = {
      id: editingRuangan
        ? editingRuangan.id
        : sanitizeId(
            `ruang-${lockedKode.toLowerCase()}-${Date.now().toString().slice(-4)}`
          ),
      kodeRuangan: lockedKode,
      namaRuangan: namaRuangan.trim(),
      subRuangan: subRuangan.trim(),
      gedung: gedung.trim(),
      lantai: lantai.trim(),
      penanggungJawab: penanggungJawab.trim(),
      nipPenanggungJawab: nipPenanggungJawab.trim(),
      unitKerja: unitKerja.trim(),
      keterangan: keterangan.trim(),
      ownerId: editingRuangan?.ownerId || 'demo-user',
      createdAt: editingRuangan?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      setIsSubmitting(true);
      await onSaveRuangan(record, Boolean(editingRuangan));
      setIsModalOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan ruangan.'
      );
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
            Ruangan &amp; Sub-Ruangan
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Menampilkan{' '}
            <strong className="font-semibold text-stone-900">
              {groupedRuangan.length}
            </strong>{' '}
            ruangan induk dan{' '}
            <strong className="font-semibold text-stone-900">
              {filteredRuangan.length}
            </strong>{' '}
            sub-ruangan lokasi inventaris.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddParentModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Ruangan</span>
        </button>
      </div>

      {/* Structured Filter Bar (Zero Overflow, Senior-Friendly Sizing) */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ruangan induk, sub-ruangan (misal: Lily 1), kode, atau penanggung jawab..."
              aria-label="Cari ruangan atau sub-ruangan"
              className="w-full h-11 pl-10 pr-4 text-[15px] text-stone-900 placeholder:text-stone-400 bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
            />
          </div>

          {gedungList.length > 0 && (
            <div className="w-full lg:w-72 shrink-0">
              <select
                aria-label="Filter berdasarkan gedung"
                value={selectedGedung}
                onChange={(e) => setSelectedGedung(e.target.value)}
                className="w-full h-11 px-3.5 text-sm text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
              >
                <option value="ALL">
                  Semua Gedung ({gedungList.length} Gedung)
                </option>
                {gedungList.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Grouped Parent -> Sub-Ruangan Hierarchy Cards */}
      {groupedRuangan.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center space-y-3">
          <Building2 className="w-8 h-8 text-stone-400 mx-auto" />
          <div className="text-base font-semibold text-stone-900">
            Tidak ada ruangan atau sub-ruangan ditemukan
          </div>
          <p className="text-sm text-stone-600 max-w-md mx-auto">
            Tambahkan ruangan induk baru beserta sub-ruangannya atau ubah kata kunci pencarian Anda.
          </p>
          <button
            type="button"
            onClick={openAddParentModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Ruangan Pertama</span>
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {roomPagination.pageItems.map((group) => {
            const subIds = new Set(group.subRuanganList.map((s) => s.id));
            const groupBarang = barangList.filter((b) =>
              subIds.has(b.ruanganId)
            );
            const groupTotalUnits = groupBarang.reduce(
              (acc, b) => acc + (Number(b.jumlah) || 0),
              0
            );

            return (
              <div
                key={group.parentName}
                className="bg-white border border-stone-200 rounded-lg overflow-hidden"
              >
                {/* Parent Room Header */}
                <div className="px-5 py-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#0F5C4D] shrink-0" />
                      <h2 className="text-base font-bold text-stone-900 uppercase tracking-tight">
                        {group.parentName}
                      </h2>
                      <span className="text-xs font-mono text-stone-600">
                        · {group.subRuanganList.length} Sub-Ruang · {groupTotalUnits} Unit ({groupBarang.length} jenis)
                      </span>
                    </div>
                    <div className="text-sm text-stone-600 pl-6">
                      <span>{group.gedung}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{group.lantai}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{group.unitKerja}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openAddSubModal(group)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-[#0F5C4D] bg-[#EBF4F2] border border-[#C7DFD9] rounded-md hover:bg-[#DCECE8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Tambah Sub-Ruang</span>
                  </button>
                </div>

                {/* Sub-Ruangan Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-stone-200 bg-white text-xs font-semibold text-stone-600">
                        <th className="py-3 px-5 w-40">Kode Ruang</th>
                        <th className="py-3 px-4">Nama Sub-Ruangan</th>
                        <th className="py-3 px-4">Penanggung Jawab</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">Jumlah Aset</th>
                        <th className="py-3 px-5 text-right whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 text-sm">
                      {group.subRuanganList.map((sub) => {
                        const subItems = barangList.filter(
                          (b) => b.ruanganId === sub.id
                        );
                        const subUnits = subItems.reduce(
                          (acc, b) => acc + (Number(b.jumlah) || 0),
                          0
                        );
                        return (
                          <tr
                            key={sub.id}
                            className="hover:bg-stone-50/80 transition-colors"
                          >
                            <td className="py-3.5 px-5 font-mono text-xs font-semibold text-stone-700 whitespace-nowrap">
                              {sub.kodeRuangan}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-start gap-2">
                                <CornerDownRight className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-semibold text-stone-900">
                                    {sub.subRuangan || `${sub.namaRuangan} (Utama)`}
                                  </div>
                                  {sub.keterangan && (
                                    <div className="text-xs text-stone-500 mt-0.5">
                                      {sub.keterangan}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-stone-800">
                                {sub.penanggungJawab}
                              </div>
                              <div className="text-xs font-mono text-stone-500 mt-0.5">
                                NIP. {sub.nipPenanggungJawab}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className="font-semibold text-stone-900">
                                {subUnits}
                              </span>{' '}
                              <span className="text-xs text-stone-500">
                                Unit ({subItems.length} jenis)
                              </span>
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setInspectRuangan(sub)}
                                  aria-label={`Lihat barang di ${sub.subRuangan || sub.namaRuangan}`}
                                  className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                                  title="Lihat Daftar Barang di Sub-Ruangan Ini"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onNavigateLaporanRuangan(sub.id)}
                                  aria-label={`Cetak KIR ${sub.subRuangan || sub.namaRuangan}`}
                                  className="p-2 text-[#0F5C4D] hover:bg-[#EBF4F2] rounded-md transition-colors cursor-pointer"
                                  title="Cetak Laporan KIR Sub-Ruangan"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(sub)}
                                  aria-label={`Edit ${sub.subRuangan || sub.namaRuangan}`}
                                  className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                                  title="Edit Sub-Ruangan"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteRuangan(sub.id)}
                                  aria-label={`Hapus ${sub.subRuangan || sub.namaRuangan}`}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Hapus Sub-Ruangan"
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
              </div>
            );
          })}

          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <TablePagination
              currentPage={roomPagination.safePage}
              totalPages={roomPagination.totalPages}
              totalItems={roomPagination.totalItems}
              startDisplay={roomPagination.startDisplay}
              endDisplay={roomPagination.endDisplay}
              pageSize={roomPagination.pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[5, 10, 25, 50]}
              itemLabel="ruangan induk"
              className="border-t-0"
            />
          </div>
        </div>
      )}

      {/* Add Parent + Multiple Sub-Ruangan / Add Sub-Ruangan / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-ruangan-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-xl w-full p-6 space-y-5 shadow-lg my-8">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2
                id="modal-ruangan-title"
                className="text-base font-bold text-stone-900"
              >
                {modalMode === 'edit'
                  ? 'Edit Data Ruangan & Sub-Ruangan'
                  : modalMode === 'add-sub'
                  ? `Tambah Sub-Ruangan di ${namaRuangan}`
                  : 'Tambah Ruangan Induk & Sub-Ruangan Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup form ruangan"
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
              {modalMode === 'new-parent' ? (
                <>
                  <div>
                    <label
                      htmlFor="input-nama-ruangan"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Nama Ruangan Induk / Bangsal / Instalasi *
                    </label>
                    <input
                      id="input-nama-ruangan"
                      type="text"
                      list="parent-ruangan-suggestions"
                      required
                      value={namaRuangan}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNamaRuangan(val);
                      }}
                      placeholder="Contoh: RUANG LILY atau INST. LABORATORIUM"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                    <datalist id="parent-ruangan-suggestions">
                      {existingParentNames.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>

                  {/* Multi Sub-Ruangan Builder */}
                  <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-stone-800">
                          Daftar Sub-Ruangan / Kamar di Dalamnya
                        </div>
                        <div className="text-[11px] text-stone-500">
                          Contoh: RUANG LILY 1, RUANG LILY 2, RUANG LILY 3 (kosongkan jika tidak punya sub-ruang)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSubDraftRow}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0F5C4D] bg-white border border-[#C7DFD9] rounded hover:bg-[#EBF4F2] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Tambah Baris</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-stone-500 uppercase tracking-wide px-0.5">
                        <div className="col-span-4 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Kode Otomatis</span>
                        </div>
                        <div className="col-span-7">Nama Sub-Ruangan / Kamar</div>
                        <div className="col-span-1" />
                      </div>
                      {subDrafts.map((row, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 items-center"
                        >
                          <div className="col-span-4 relative">
                            <input
                              type="text"
                              readOnly
                              tabIndex={-1}
                              aria-label={`Kode otomatis sub-ruangan ${idx + 1}`}
                              value={autoSubDraftCodes[idx] || ''}
                              title="Kode ruang dibuat otomatis oleh sistem dan tidak dapat diubah manual"
                              className="w-full pl-2.5 pr-7 py-1.5 text-xs font-mono font-semibold text-stone-600 bg-stone-100 border border-stone-200 rounded cursor-not-allowed select-none focus:outline-none"
                            />
                            <Lock className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                          <div className="col-span-7">
                            <input
                              type="text"
                              aria-label={`Nama sub-ruangan ${idx + 1}`}
                              value={row.nama}
                              onChange={(e) =>
                                handleUpdateSubDraft(idx, e.target.value)
                              }
                              placeholder={
                                namaRuangan.trim()
                                  ? `Contoh: ${namaRuangan.trim()} ${idx + 1}`
                                  : `Contoh: RUANG LILY ${idx + 1}`
                              }
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-[#0F5C4D]"
                            />
                          </div>
                          <div className="col-span-1 text-right">
                            {subDrafts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSubDraft(idx)}
                                aria-label={`Hapus baris sub-ruangan ${idx + 1}`}
                                className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor="input-kode-ruangan"
                        className="flex items-center gap-1 text-xs font-semibold text-stone-700 mb-1"
                      >
                        <Lock className="w-3 h-3 text-stone-500" />
                        <span>
                          Kode Sub-Ruang ({modalMode === 'edit' ? 'Terkunci' : 'Otomatis'})
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          id="input-kode-ruangan"
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={resolvedSingleKodeRuangan}
                          title="Kode ruang dibuat otomatis oleh sistem dan terkunci agar konsisten dengan QR & riwayat mutasi"
                          className="w-full pl-3 pr-8 py-2 text-xs font-mono font-semibold text-stone-600 bg-stone-100 border border-stone-200 rounded-lg cursor-not-allowed select-none focus:outline-none"
                        />
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="input-nama-ruangan"
                        className="block text-xs font-semibold text-stone-700 mb-1"
                      >
                        Nama Ruangan Induk / Instalasi *
                      </label>
                      <input
                        id="input-nama-ruangan"
                        type="text"
                        list="parent-ruangan-suggestions-edit"
                        required
                        value={namaRuangan}
                        onChange={(e) => setNamaRuangan(e.target.value)}
                        placeholder="Contoh: RUANG LILY"
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                      />
                      <datalist id="parent-ruangan-suggestions-edit">
                        {existingParentNames.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="input-sub-ruangan"
                      className="block text-xs font-semibold text-stone-700 mb-1"
                    >
                      Nama Sub-Ruangan / Kamar (Tempat Barang Berada) *
                    </label>
                    <input
                      id="input-sub-ruangan"
                      type="text"
                      required={modalMode === 'add-sub'}
                      value={subRuangan}
                      onChange={(e) => setSubRuangan(e.target.value)}
                      placeholder="Contoh: RUANG LILY 3 atau R. PATOLOGI ANATOMI"
                      className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="input-gedung"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Gedung / Blok *
                  </label>
                  <input
                    id="input-gedung"
                    type="text"
                    required
                    value={gedung}
                    onChange={(e) => setGedung(e.target.value)}
                    placeholder="Gedung Rawat Inap"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-lantai"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Lantai *
                  </label>
                  <input
                    id="input-lantai"
                    type="text"
                    required
                    value={lantai}
                    onChange={(e) => setLantai(e.target.value)}
                    placeholder="Lantai 2"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-unit-kerja"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Unit Kerja / Bidang *
                  </label>
                  <input
                    id="input-unit-kerja"
                    type="text"
                    required
                    value={unitKerja}
                    onChange={(e) => setUnitKerja(e.target.value)}
                    placeholder="Instalasi Rawat Inap"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="input-pj-ruangan"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Nama Penanggung Jawab Ruangan *
                  </label>
                  <input
                    id="input-pj-ruangan"
                    type="text"
                    required
                    value={penanggungJawab}
                    onChange={(e) => setPenanggungJawab(e.target.value)}
                    placeholder="Ns. Dewi Kartika, S.Kep"
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="input-nip-pj"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    NIP / Nomor Induk Pegawai *
                  </label>
                  <input
                    id="input-nip-pj"
                    type="text"
                    required
                    value={nipPenanggungJawab}
                    onChange={(e) => setNipPenanggungJawab(e.target.value)}
                    placeholder="198803152012012006"
                    className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-lg focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-ket-ruangan"
                  className="block text-xs font-semibold text-stone-700 mb-1"
                >
                  Keterangan Ruangan
                </label>
                <textarea
                  id="input-ket-ruangan"
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Catatan fungsi ruangan atau spesifikasi kamar..."
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
                  {isSubmitting
                    ? 'Menyimpan...'
                    : modalMode === 'new-parent'
                    ? 'Simpan Ruangan & Sub-Ruangan'
                    : modalMode === 'add-sub'
                    ? 'Simpan Sub-Ruangan'
                    : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Sub-Ruangan Modal */}
      {inspectRuangan && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-3xl w-full p-6 space-y-5 shadow-lg">
            <div className="flex items-start justify-between border-b border-stone-200 pb-4">
              <div>
                <div className="text-xs font-mono text-stone-500">
                  {inspectRuangan.kodeRuangan} · {inspectRuangan.gedung} ({inspectRuangan.lantai})
                </div>
                <h2 className="text-lg font-bold text-stone-900">
                  {inspectRuangan.namaRuangan}
                  {inspectRuangan.subRuangan
                    ? ` → ${inspectRuangan.subRuangan}`
                    : ''}
                </h2>
                <div className="text-xs text-stone-600 mt-0.5">
                  Penanggung Jawab: <strong>{inspectRuangan.penanggungJawab}</strong> (NIP. {inspectRuangan.nipPenanggungJawab})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectRuangan(null)}
                aria-label="Tutup detail ruangan"
                className="p-1 text-slate-400 hover:text-stone-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const items = barangList.filter(
                (b) => b.ruanganId === inspectRuangan.id
              );
              if (items.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-stone-500">
                    Belum ada barang inventaris yang ditempatkan di sub-ruangan ini.
                  </div>
                );
              }
              const inspectPagination = paginateItems(
                items,
                inspectPage,
                inspectPageSize
              );
              return (
                <div className="border border-stone-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-500">
                          <th className="py-2.5 px-3">Jenis / Nama Barang</th>
                          <th className="py-2.5 px-3">Merk / Model</th>
                          <th className="py-2.5 px-3">Ukuran &amp; Bahan</th>
                          <th className="py-2.5 px-3">No. Kode Barang</th>
                          <th className="py-2.5 px-3 text-right">Tahun</th>
                          <th className="py-2.5 px-3 text-right">Jumlah</th>
                          <th className="py-2.5 px-3">Keadaan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {inspectPagination.pageItems.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2.5 px-3 font-medium text-stone-900">
                              {item.namaBarang}
                            </td>
                            <td className="py-2.5 px-3 text-stone-700">
                              {item.merkTipe || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-stone-700">
                              {item.ukuran ? `${item.ukuran} · ` : ''}
                              {item.bahan}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {item.kodeBarang}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {item.tahunPerolehan}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {item.jumlah} {item.satuan}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {item.kondisi}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {items.length > 10 && (
                    <TablePagination
                      compact
                      currentPage={inspectPagination.safePage}
                      totalPages={inspectPagination.totalPages}
                      totalItems={inspectPagination.totalItems}
                      startDisplay={inspectPagination.startDisplay}
                      endDisplay={inspectPagination.endDisplay}
                      pageSize={inspectPagination.pageSize}
                      onPageChange={setInspectPage}
                      onPageSizeChange={(nextSize) => {
                        setInspectPageSize(nextSize);
                        setInspectPage(1);
                      }}
                      pageSizeOptions={[10, 25, 50]}
                      itemLabel="barang"
                    />
                  )}
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const id = inspectRuangan.id;
                    setInspectRuangan(null);
                    onNavigateQrRuangan(id);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 cursor-pointer"
                >
                  Cetak Label QR Sub-Ruangan Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = inspectRuangan.id;
                    setInspectRuangan(null);
                    onNavigateLaporanRuangan(id);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5C4D] rounded-lg hover:bg-[#0B463B] cursor-pointer"
                >
                  Cetak Lembar KIR Sub-Ruangan
                </button>
              </div>
              <button
                type="button"
                onClick={() => setInspectRuangan(null)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
