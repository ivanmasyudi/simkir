import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { MasterReferensi, MasterReferensiJenis } from '../types/kir';
import { sanitizeId } from '../utils/kirLogic';
import {
  getMissingDefaultSeeds,
  MASTER_REFERENSI_TABS,
  validateMasterReferensiInput,
} from '../utils/masterReferensi';
import { paginateItems } from '../utils/tablePagination';
import { TablePagination } from './TablePagination';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface MasterReferensiViewProps {
  masterList: MasterReferensi[];
  ownerId: string;
  onSaveMaster: (item: MasterReferensi, isEdit: boolean) => Promise<void>;
  onSaveMasterBatch: (items: MasterReferensi[]) => Promise<void>;
  onDeleteMaster: (id: string) => Promise<void>;
}

export const MasterReferensiView: React.FC<MasterReferensiViewProps> = ({
  masterList,
  ownerId,
  onSaveMaster,
  onSaveMasterBatch,
  onDeleteMaster,
}) => {
  const [activeJenis, setActiveJenis] = useState<MasterReferensiJenis>('satuan');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterReferensi | null>(null);
  const [deleteTargetItem, setDeleteTargetItem] =
    useState<MasterReferensi | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeedingDefaults, setIsSeedingDefaults] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const activeMeta =
    MASTER_REFERENSI_TABS.find((t) => t.jenis === activeJenis) ||
    MASTER_REFERENSI_TABS[0];

  useEffect(() => {
    setCurrentPage(1);
    setSearch('');
  }, [activeJenis]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const itemsForTab = masterList
    .filter((item) => item.jenis === activeJenis)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }));

  const filteredItems = itemsForTab.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.nama.toLowerCase().includes(q) ||
      item.kode.toLowerCase().includes(q) ||
      item.keterangan.toLowerCase().includes(q)
    );
  });

  const pagination = paginateItems(filteredItems, currentPage, pageSize);

  const missingForCurrentTab = getMissingDefaultSeeds(
    masterList,
    ownerId,
    activeJenis
  );
  const missingAll = getMissingDefaultSeeds(masterList, ownerId);

  const openAddModal = () => {
    setEditingItem(null);
    setNama('');
    setKode('');
    setKeterangan('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MasterReferensi) => {
    setEditingItem(item);
    setNama(item.nama);
    setKode(item.kode || '');
    setKeterangan(item.keterangan || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateMasterReferensiInput(
      {
        jenis: activeJenis,
        nama,
        kode: activeMeta.hasKode ? kode : '',
        keterangan,
      },
      masterList,
      editingItem?.id
    );
    if (!validation.valid) {
      setFormError(validation.error || 'Periksa kembali isian master.');
      return;
    }

    const nowIso = new Date().toISOString();
    const record: MasterReferensi = {
      id:
        editingItem?.id ||
        sanitizeId(`ref-${activeJenis}-${Date.now().toString().slice(-6)}`),
      jenis: activeJenis,
      nama:
        activeJenis === 'satuan' || activeJenis === 'bahan'
          ? nama.trim().toUpperCase()
          : nama.trim(),
      kode: activeMeta.hasKode ? kode.trim() : '',
      keterangan: keterangan.trim(),
      ownerId: editingItem?.ownerId || ownerId || 'demo-user',
      createdAt: editingItem?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      setIsSubmitting(true);
      await onSaveMaster(record, Boolean(editingItem));
      setIsModalOpen(false);
      setStatusNotice(
        editingItem
          ? `${activeMeta.shortLabel} "${record.nama}" berhasil diperbarui.`
          : `${activeMeta.shortLabel} "${record.nama}" berhasil ditambahkan.`
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal menyimpan master referensi.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedDefaults = async (onlyCurrentTab: boolean) => {
    const toCreate = onlyCurrentTab ? missingForCurrentTab : missingAll;
    if (toCreate.length === 0) return;
    try {
      setIsSeedingDefaults(true);
      setStatusNotice(null);
      await onSaveMasterBatch(toCreate);
      setStatusNotice(
        onlyCurrentTab
          ? `${toCreate.length} item standar ${activeMeta.label} berhasil dimuat.`
          : `${toCreate.length} item standar untuk seluruh Master Referensi berhasil dimuat.`
      );
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Gagal memuat daftar standar.'
      );
    } finally {
      setIsSeedingDefaults(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Master Referensi Barang
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Kelola daftar baku Satuan, Bahan, Ukuran, Merk/Model, dan Katalog Kode Barang agar pengisian form barang lebih cepat dan seragam.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {missingAll.length > 0 && (
            <button
              type="button"
              onClick={() => handleSeedDefaults(false)}
              disabled={isSeedingDefaults}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0F5C4D] bg-white border border-[#C7DFD9] rounded-md hover:bg-[#EBF4F2] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {isSeedingDefaults
                  ? 'Memuat Standar...'
                  : `Muat Daftar Standar (${missingAll.length})`}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah {activeMeta.shortLabel}</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusNotice && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#EBF4F2] border border-[#C7DFD9] rounded-lg text-sm text-[#0B463B]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs font-semibold underline cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Clean Tab Bar */}
      <div
        role="tablist"
        aria-label="Kategori Master Referensi"
        className="flex flex-wrap gap-2 border-b border-stone-200 pb-3"
      >
        {MASTER_REFERENSI_TABS.map((tab) => {
          const count = masterList.filter((m) => m.jenis === tab.jenis).length;
          const isActive = activeJenis === tab.jenis;
          return (
            <button
              key={tab.jenis}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveJenis(tab.jenis)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm rounded-md border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#0F5C4D] text-white border-[#0F5C4D] font-semibold'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 font-medium'
              }`}
            >
              <span>{tab.shortLabel}</span>
              <span
                className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Content Card */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {/* Toolbar inside Card */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-stone-900">
              {activeMeta.label}
            </h2>
            <p className="text-sm text-stone-600 mt-0.5">
              {activeMeta.description}
            </p>
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={`Cari ${activeMeta.label}`}
              placeholder={`Cari ${activeMeta.shortLabel.toLowerCase()}...`}
              className="w-full h-10 pl-9 pr-3 text-sm bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
            />
          </div>
        </div>

        {/* Table or Empty State */}
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-lg bg-stone-100 flex items-center justify-center text-stone-500">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-stone-900">
                {itemsForTab.length === 0
                  ? `Belum ada data ${activeMeta.label} tersimpan`
                  : 'Tidak ada item yang cocok dengan pencarian'}
              </div>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                {itemsForTab.length === 0
                  ? 'Saat kosong, form Tambah & Edit Barang tetap menyediakan pilihan bawaan. Muat daftar standar RSUD atau tambahkan item Anda sendiri.'
                  : 'Coba ubah kata kunci pencarian Anda.'}
              </p>
            </div>

            {itemsForTab.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {missingForCurrentTab.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSeedDefaults(true)}
                    disabled={isSeedingDefaults}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0F5C4D] bg-[#EBF4F2] border border-[#C7DFD9] rounded-md hover:bg-[#DCECE8] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      Muat {missingForCurrentTab.length} Standar {activeMeta.shortLabel}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah {activeMeta.shortLabel}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-sm font-semibold text-stone-700">
                    <th className="py-3 px-4 w-14">No</th>
                    {activeMeta.hasKode && (
                      <th className="py-3 px-4 whitespace-nowrap">
                        {activeMeta.kodeLabel || 'Kode'}
                      </th>
                    )}
                    <th className="py-3 px-4">{activeMeta.namaLabel}</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-right w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-sm">
                  {pagination.pageItems.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-stone-500 tabular-nums">
                        {pagination.startIndex + idx + 1}
                      </td>
                      {activeMeta.hasKode && (
                        <td className="py-3.5 px-4 font-mono font-semibold text-stone-800 whitespace-nowrap">
                          {item.kode || '-'}
                        </td>
                      )}
                      <td className="py-3.5 px-4 font-semibold text-stone-900">
                        {item.nama}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600">
                        {item.keterangan || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            aria-label={`Edit ${item.nama}`}
                            title="Edit"
                            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteItemError(null);
                              setDeleteTargetItem(item);
                            }}
                            aria-label={`Hapus ${item.nama}`}
                            title="Hapus"
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
              pageSizeOptions={[10, 25, 50]}
              itemLabel={activeMeta.shortLabel.toLowerCase()}
            />
          </>
        )}
      </div>

      {/* Add / Edit Master Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-master-ref-title"
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-md w-full p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h2
                id="modal-master-ref-title"
                className="text-base font-bold text-stone-900"
              >
                {editingItem
                  ? `Edit ${activeMeta.label}`
                  : `Tambah ${activeMeta.label}`}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup form master"
                className="p-1 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeMeta.hasKode && (
                <div>
                  <label
                    htmlFor="input-master-kode"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    {activeMeta.kodeLabel || 'Kode'} *
                  </label>
                  <input
                    id="input-master-kode"
                    type="text"
                    required
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    placeholder={activeMeta.kodePlaceholder}
                    className="w-full px-3 py-2 text-sm font-mono border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="input-master-nama"
                  className="block text-xs font-semibold text-stone-700 mb-1"
                >
                  {activeMeta.namaLabel} *
                </label>
                <input
                  id="input-master-nama"
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder={activeMeta.namaPlaceholder}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
                />
              </div>

              <div>
                <label
                  htmlFor="input-master-keterangan"
                  className="block text-xs font-semibold text-stone-700 mb-1"
                >
                  Keterangan (Opsional)
                </label>
                <input
                  id="input-master-keterangan"
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Catatan singkat penggunaan..."
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-md hover:bg-stone-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi Hapus Master Referensi */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTargetItem)}
        title={`Hapus ${activeMeta.label}?`}
        description="Item master yang dihapus tidak akan muncul lagi pada pilihan dropdown."
        itemName={
          deleteTargetItem
            ? deleteTargetItem.kode
              ? `${deleteTargetItem.kode} — ${deleteTargetItem.nama}`
              : deleteTargetItem.nama
            : ''
        }
        details={
          deleteTargetItem
            ? [
                { label: 'Kategori Master', value: activeMeta.label },
                {
                  label: 'Keterangan',
                  value: deleteTargetItem.keterangan || '-',
                },
              ]
            : []
        }
        warningText="Data barang inventaris yang sudah pernah disimpan dengan nilai ini tidak akan ikut terhapus."
        confirmLabel="Ya, Hapus Master"
        isDeleting={isDeletingItem}
        errorMessage={deleteItemError}
        onCancel={() => {
          if (!isDeletingItem) {
            setDeleteTargetItem(null);
            setDeleteItemError(null);
          }
        }}
        onConfirm={async () => {
          if (!deleteTargetItem) return;
          try {
            setIsDeletingItem(true);
            setDeleteItemError(null);
            const deletedName = deleteTargetItem.nama;
            await onDeleteMaster(deleteTargetItem.id);
            setDeleteTargetItem(null);
            setStatusNotice(
              `${activeMeta.shortLabel} "${deletedName}" berhasil dihapus.`
            );
          } catch (err) {
            setDeleteItemError(
              err instanceof Error
                ? err.message
                : 'Gagal menghapus item master. Coba lagi.'
            );
          } finally {
            setIsDeletingItem(false);
          }
        }}
      />
    </div>
  );
};
