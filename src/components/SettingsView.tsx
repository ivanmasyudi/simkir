import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';
import { InstansiSetting } from '../types/kir';
import {
  formatResetSummaryMessage,
  isResetConfirmationValid,
  RESET_CONFIRMATION_PHRASE,
  ResetDataSummary,
} from '../utils/firebaseReset';

interface SettingsViewProps {
  instansi: InstansiSetting;
  onUpdateInstansi: (next: InstansiSetting) => void;
  userEmail: string | null;
  isSeedingCloud: boolean;
  isResettingCloud: boolean;
  hasExistingData: boolean;
  dataCounts: {
    ruangan: number;
    barang: number;
    mutasi: number;
  };
  onSeedCloudData: () => void;
  onResetCloudData: (alsoResetInstansi: boolean) => Promise<ResetDataSummary>;
  onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  instansi,
  onUpdateInstansi,
  userEmail,
  isSeedingCloud,
  isResettingCloud,
  hasExistingData,
  dataCounts,
  onSeedCloudData,
  onResetCloudData,
  onSignOut,
}) => {
  const [savedNotice, setSavedNotice] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [alsoResetInstansi, setAlsoResetInstansi] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  const totalRecords =
    dataCounts.ruangan + dataCounts.barang + dataCounts.mutasi;
  const canConfirmReset =
    isResetConfirmationValid(confirmPhrase) && !isResettingCloud;

  const openResetModal = () => {
    setConfirmPhrase('');
    setAlsoResetInstansi(false);
    setResetError(null);
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isResetConfirmationValid(confirmPhrase)) {
      setResetError(
        `Ketik persis "${RESET_CONFIRMATION_PHRASE}" untuk mengonfirmasi pengosongan data.`
      );
      return;
    }
    setResetError(null);
    try {
      const summary = await onResetCloudData(alsoResetInstansi);
      setIsResetModalOpen(false);
      setConfirmPhrase('');
      setResetSuccessMsg(formatResetSummaryMessage(summary));
    } catch (err) {
      setResetError(
        err instanceof Error
          ? err.message
          : 'Gagal mereset database Firebase. Coba lagi.'
      );
    }
  };

  const handleFieldChange = <K extends keyof InstansiSetting>(
    field: K,
    value: InstansiSetting[K]
  ) => {
    onUpdateInstansi({ ...instansi, [field]: value });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            Pengaturan
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            Atur identitas instansi, penandatangan laporan KIR, serta akun dan koneksi database.
          </p>
        </div>
        {savedNotice && (
          <span className="text-sm font-medium text-[#0F5C4D]">
            Perubahan tersimpan otomatis
          </span>
        )}
      </div>

      {/* Section 1: Koneksi Database & Akun */}
      <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Koneksi Database & Akun
          </h2>
          <p className="text-sm text-stone-600 mt-0.5">
            Seluruh data ruangan, barang, dan mutasi tersimpan langsung ke database Firebase Firestore.
          </p>
        </div>

        <dl className="divide-y divide-stone-200 border-t border-b border-stone-200 text-[15px]">
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-stone-600">Status Database</dt>
            <dd className="font-semibold text-[#0F5C4D]">
              Terhubung ke Firebase Firestore
            </dd>
          </div>
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-stone-600">Akun Google Aktif</dt>
            <dd className="font-medium text-stone-900">
              {userEmail || '-'}
            </dd>
          </div>
          <div className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-stone-600">Data Tersimpan Saat Ini</dt>
            <dd className="font-mono text-sm text-stone-900 tabular-nums">
              {dataCounts.ruangan} Ruangan · {dataCounts.barang} Barang ·{' '}
              {dataCounts.mutasi} Mutasi
            </dd>
          </div>
        </dl>

        {resetSuccessMsg && (
          <div className="flex items-start gap-2.5 p-3.5 bg-[#EBF4F2] border border-[#C7DFD9] rounded-md text-sm text-[#0B463B]">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0F5C4D]" />
            <div className="flex-1">{resetSuccessMsg}</div>
            <button
              type="button"
              onClick={() => setResetSuccessMsg(null)}
              aria-label="Tutup notifikasi reset"
              className="text-stone-500 hover:text-stone-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onSeedCloudData}
            disabled={isSeedingCloud || isResettingCloud}
            className="px-4 py-2.5 text-sm font-medium text-stone-800 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isSeedingCloud
              ? 'Sedang Memuat Data...'
              : hasExistingData
              ? 'Muat Ulang Data Contoh'
              : 'Muat Data Contoh ke Database'}
          </button>

          <button
            type="button"
            onClick={openResetModal}
            disabled={isSeedingCloud || isResettingCloud}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>
              {isResettingCloud
                ? 'Sedang Mengosongkan...'
                : 'Reset Data Firebase (Mulai Kosong)'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            disabled={isResettingCloud}
            className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            Keluar dari Akun
          </button>
        </div>
      </section>

      {/* Section 2: Identitas Instansi & Penandatangan */}
      <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Identitas Instansi & Penandatangan Laporan
          </h2>
          <p className="text-sm text-stone-600 mt-0.5">
            Nama direktur, pengurus barang, dan kop instansi ini digunakan otomatis pada cetak KIR, Excel, dan BAST Mutasi.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="setting-propinsi"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Provinsi
            </label>
            <input
              id="setting-propinsi"
              type="text"
              value={instansi.propinsi}
              onChange={(e) => handleFieldChange('propinsi', e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div>
            <label
              htmlFor="setting-kotakab"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Kota / Kabupaten
            </label>
            <input
              id="setting-kotakab"
              type="text"
              value={instansi.kotaKab}
              onChange={(e) => handleFieldChange('kotaKab', e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="setting-unit"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Nama Unit / Rumah Sakit
            </label>
            <input
              id="setting-unit"
              type="text"
              value={instansi.unit}
              onChange={(e) => handleFieldChange('unit', e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="setting-satker"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Satuan Kerja
            </label>
            <input
              id="setting-satker"
              type="text"
              value={instansi.satuanKerja}
              onChange={(e) => handleFieldChange('satuanKerja', e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div>
            <label
              htmlFor="setting-kodelokasi"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              No. Kode Lokasi
            </label>
            <input
              id="setting-kodelokasi"
              type="text"
              value={instansi.kodeLokasi}
              onChange={(e) => handleFieldChange('kodeLokasi', e.target.value)}
              className="w-full px-3.5 py-2.5 text-[15px] font-mono text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div>
            <label
              htmlFor="setting-tahun"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Tahun Data Pelaporan
            </label>
            <input
              id="setting-tahun"
              type="text"
              value={instansi.tahunPelaporan}
              onChange={(e) =>
                handleFieldChange('tahunPelaporan', e.target.value)
              }
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>
        </div>

        <div className="border-t border-stone-200 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="setting-direktur"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Nama Direktur
            </label>
            <input
              id="setting-direktur"
              type="text"
              value={instansi.namaKepalaUnit}
              onChange={(e) =>
                handleFieldChange('namaKepalaUnit', e.target.value)
              }
              placeholder="Contoh: dr. H. Ahmad, Sp.PD"
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div>
            <label
              htmlFor="setting-nip-direktur"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              NIP Direktur
            </label>
            <input
              id="setting-nip-direktur"
              type="text"
              value={instansi.nipKepalaUnit}
              onChange={(e) =>
                handleFieldChange('nipKepalaUnit', e.target.value)
              }
              placeholder="Contoh: 197805202006041009"
              className="w-full px-3.5 py-2.5 text-[15px] font-mono text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div>
            <label
              htmlFor="setting-pengurus"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              Nama Pengurus Barang
            </label>
            <input
              id="setting-pengurus"
              type="text"
              value={instansi.namaPengurusBarang}
              onChange={(e) =>
                handleFieldChange('namaPengurusBarang', e.target.value)
              }
              className="w-full px-3.5 py-2.5 text-[15px] text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>

          <div>
            <label
              htmlFor="setting-nip-pengurus"
              className="block text-sm font-medium text-stone-800 mb-1.5"
            >
              NIP Pengurus Barang
            </label>
            <input
              id="setting-nip-pengurus"
              type="text"
              value={instansi.nipPengurusBarang}
              onChange={(e) =>
                handleFieldChange('nipPengurusBarang', e.target.value)
              }
              className="w-full px-3.5 py-2.5 text-[15px] font-mono text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-[#0F5C4D]"
            />
          </div>
        </div>
      </section>

      {/* Modal Konfirmasi Reset Data Firebase (2-Langkah Aman) */}
      {isResetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-reset-firebase-title"
          className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-stone-200 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-lg">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-700 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="modal-reset-firebase-title"
                    className="text-lg font-bold text-stone-900"
                  >
                    Reset Data Firebase (Mulai Kosong)
                  </h2>
                  <p className="text-sm text-stone-600 mt-0.5">
                    Tindakan ini akan menghapus permanen seluruh data inventaris di akun Anda.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isResettingCloud && setIsResetModalOpen(false)}
                aria-label="Tutup konfirmasi reset"
                className="p-1 text-stone-400 hover:text-stone-700 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rincian Data yang Akan Dihapus */}
            <div className="bg-stone-50 border border-stone-200 rounded-md p-4 space-y-2 text-sm">
              <div className="font-semibold text-stone-900">
                Data di Firebase yang akan dihapus permanen:
              </div>
              <ul className="space-y-1 text-stone-700 list-disc pl-5">
                <li>
                  <strong className="font-mono text-stone-900">
                    {dataCounts.ruangan}
                  </strong>{' '}
                  Ruangan &amp; Sub-Ruangan
                </li>
                <li>
                  <strong className="font-mono text-stone-900">
                    {dataCounts.barang}
                  </strong>{' '}
                  Data Barang Inventaris
                </li>
                <li>
                  <strong className="font-mono text-stone-900">
                    {dataCounts.mutasi}
                  </strong>{' '}
                  Riwayat Mutasi &amp; BAST
                </li>
              </ul>
              <p className="text-xs text-stone-600 pt-1">
                {totalRecords === 0
                  ? 'Saat ini database Anda sudah kosong (0 data).'
                  : 'Data yang sudah dihapus tidak dapat dikembalikan lagi.'}
              </p>
            </div>

            <form onSubmit={handleConfirmReset} className="space-y-4">
              <label className="flex items-start gap-2.5 text-sm text-stone-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoResetInstansi}
                  onChange={(e) => setAlsoResetInstansi(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-stone-300 text-[#0F5C4D]"
                />
                <span>
                  Sekalian kembalikan pengaturan kop instansi, logo, dan nama Direktur ke pengaturan bawaan{' '}
                  <span className="text-stone-500">
                    (biarkan tidak dicentang jika ingin tetap menyimpan kop &amp; nama Direktur)
                  </span>
                </span>
              </label>

              <div>
                <label
                  htmlFor="input-confirm-reset-phrase"
                  className="block text-sm font-medium text-stone-800 mb-1.5"
                >
                  Ketik{' '}
                  <strong className="font-mono text-red-700">
                    {RESET_CONFIRMATION_PHRASE}
                  </strong>{' '}
                  untuk konfirmasi:
                </label>
                <input
                  id="input-confirm-reset-phrase"
                  type="text"
                  autoComplete="off"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  placeholder={RESET_CONFIRMATION_PHRASE}
                  className="w-full h-11 px-3.5 text-[15px] font-mono text-stone-900 bg-white border border-stone-300 rounded-md focus:outline-none focus:border-red-600"
                />
              </div>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {resetError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  disabled={isResettingCloud}
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 disabled:opacity-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!canConfirmReset}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isResettingCloud
                      ? 'Mengosongkan Database...'
                      : 'Kosongkan Database Sekarang'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
