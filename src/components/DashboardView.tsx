import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { ActiveTab, Barang, InstansiSetting, Mutasi, Ruangan } from '../types/kir';
import { calculateKirStats, groupRuanganByParent } from '../utils/kirLogic';
import { TablePagination } from './TablePagination';
import { paginateItems } from '../utils/tablePagination';

interface DashboardViewProps {
  barangList: Barang[];
  ruanganList: Ruangan[];
  mutasiList: Mutasi[];
  instansi: InstansiSetting;
  onNavigate: (tab: ActiveTab, filterRuanganId?: string) => void;
  onOpenAddBarang: () => void;
  onOpenAddMutasi: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  barangList,
  ruanganList,
  mutasiList,
  instansi,
  onNavigate,
  onOpenAddBarang,
  onOpenAddMutasi,
}) => {
  const [roomSearch, setRoomSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setCurrentPage(1);
  }, [roomSearch]);

  const stats = calculateKirStats(barangList, ruanganList, mutasiList);
  const filteredRuanganForDashboard = ruanganList.filter((r) => {
    const q = roomSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.namaRuangan.toLowerCase().includes(q) ||
      (r.subRuangan ?? '').toLowerCase().includes(q) ||
      r.kodeRuangan.toLowerCase().includes(q) ||
      r.penanggungJawab.toLowerCase().includes(q) ||
      r.gedung.toLowerCase().includes(q)
    );
  });
  const groupedRooms = groupRuanganByParent(filteredRuanganForDashboard);
  const roomPagination = paginateItems(groupedRooms, currentPage, pageSize);

  const summarizeItems = (items: Barang[]) => {
    const totalUnit = items.reduce((acc, b) => acc + (Number(b.jumlah) || 0), 0);
    const baik = items
      .filter((b) => b.kondisi === 'Baik')
      .reduce((acc, b) => acc + (Number(b.jumlah) || 0), 0);
    const kurangBaik = items
      .filter((b) => b.kondisi === 'Kurang Baik')
      .reduce((acc, b) => acc + (Number(b.jumlah) || 0), 0);
    const rusakBerat = items
      .filter((b) => b.kondisi === 'Rusak Berat')
      .reduce((acc, b) => acc + (Number(b.jumlah) || 0), 0);
    return { jenisCount: items.length, totalUnit, baik, kurangBaik, rusakBerat };
  };

  const rusakTotal = stats.kondisiKurangBaik + stats.kondisiRusakBerat;

  return (
    <div className="space-y-8">
      {/* Simple Page Header — 1 title, 1 primary button */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Ringkasan Inventaris Ruangan
          </h1>
          <p className="text-[15px] text-stone-600 mt-1">
            {instansi.kotaKab} · Kode Lokasi {instansi.kodeLokasi}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddBarang}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-[15px] font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Barang</span>
        </button>
      </div>

      {/* Single Calm Summary Strip (no 4 floating icon cards) */}
      <div className="bg-white border border-stone-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-stone-200">
        <div className="p-5 sm:p-6">
          <div className="text-sm text-stone-600">Total Barang</div>
          <div className="text-3xl font-bold text-stone-900 font-mono tabular-nums mt-1.5">
            {stats.totalUnitBarang}
            <span className="text-base font-normal text-stone-500 ml-1.5">unit</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">
            {stats.totalJenisBarang} jenis tercatat
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="text-sm text-stone-600">Kondisi Baik</div>
          <div className="text-3xl font-bold text-[#166534] font-mono tabular-nums mt-1.5">
            {stats.kondisiBaik}
            <span className="text-base font-normal text-stone-500 ml-1.5">unit</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">
            {stats.persenBaik}% dari total aset
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="text-sm text-stone-600">Kurang Baik / Rusak</div>
          <div className="text-3xl font-bold text-stone-900 font-mono tabular-nums mt-1.5">
            {rusakTotal}
            <span className="text-base font-normal text-stone-500 ml-1.5">unit</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">
            {stats.kondisiKurangBaik} kurang baik · {stats.kondisiRusakBerat} rusak berat
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="text-sm text-stone-600">Jumlah Ruangan</div>
          <div className="text-3xl font-bold text-stone-900 font-mono tabular-nums mt-1.5">
            {stats.totalRuangan}
            <span className="text-base font-normal text-stone-500 ml-1.5">ruang</span>
          </div>
          <div className="text-sm text-stone-500 mt-1">
            Dalam {stats.totalParentRuangan} ruangan induk
          </div>
        </div>
      </div>

      {/* Main Content: Spacious, Easy-to-Read Ruangan Table */}
      <section className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Daftar Ruangan &amp; Isi Barang
            </h2>
            <p className="text-sm text-stone-600 mt-0.5">
              Pilih ruangan di bawah untuk melihat daftar barang atau mencetak Kartu Inventaris Ruangan.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            {ruanganList.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  placeholder="Cari ruangan atau PJ..."
                  aria-label="Cari ruangan di beranda"
                  className="w-full h-10 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 bg-stone-50 border border-stone-300 rounded-md focus:outline-none focus:bg-white focus:border-[#0F5C4D]"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate('ruangan')}
              className="text-sm font-semibold text-[#0F5C4D] hover:underline whitespace-nowrap shrink-0 text-left cursor-pointer"
            >
              Kelola Ruangan
            </button>
          </div>
        </div>

        {groupedRooms.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-3">
            <p className="text-[15px] text-stone-700">
              {roomSearch.trim()
                ? 'Tidak ada ruangan yang cocok dengan kata kunci pencarian.'
                : 'Belum ada data ruangan di database.'}
            </p>
            {roomSearch.trim() ? (
              <button
                type="button"
                onClick={() => setRoomSearch('')}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 border border-stone-300 rounded-md hover:bg-stone-200 cursor-pointer"
              >
                Reset Pencarian
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('ruangan')}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-[#0F5C4D] rounded-md hover:bg-[#0B463B] cursor-pointer"
              >
                Tambah Ruangan Pertama
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-sm font-semibold text-stone-700">
                    <th className="py-3.5 px-5">Nama Ruangan</th>
                    <th className="py-3.5 px-5">Penanggung Jawab</th>
                    <th className="py-3.5 px-5 text-right">Jumlah</th>
                    <th className="py-3.5 px-5 text-right">Kondisi</th>
                    <th className="py-3.5 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-[15px]">
                  {roomPagination.pageItems.map((group) => {
                  const subIds = new Set(group.subRuanganList.map((s) => s.id));
                  const groupStats = summarizeItems(
                    barangList.filter((b) => subIds.has(b.ruanganId))
                  );
                  return (
                    <React.Fragment key={group.parentName}>
                      {/* Parent Room Header Row */}
                      <tr className="bg-stone-50/70">
                        <td className="py-3 px-5" colSpan={2}>
                          <div className="font-semibold text-stone-900">
                            {group.parentName}
                          </div>
                          <div className="text-sm text-stone-500">
                            {group.gedung} · {group.lantai}
                          </div>
                        </td>
                        <td className="py-3 px-5 text-right font-mono tabular-nums font-semibold text-stone-800 whitespace-nowrap">
                          {groupStats.totalUnit} unit
                        </td>
                        <td className="py-3 px-5 text-right text-sm text-stone-600 whitespace-nowrap">
                          {group.subRuanganList.length} sub-ruang
                        </td>
                        <td className="py-3 px-5" />
                      </tr>

                      {/* Sub-Ruangan Rows */}
                      {group.subRuanganList.map((sub) => {
                        const subStats = summarizeItems(
                          barangList.filter((b) => b.ruanganId === sub.id)
                        );
                        const rusakSub =
                          subStats.kurangBaik + subStats.rusakBerat;
                        return (
                          <tr
                            key={sub.id}
                            className="hover:bg-stone-50 transition-colors"
                          >
                            <td className="py-3.5 px-5 pl-8">
                              <div className="font-medium text-stone-900">
                                {sub.subRuangan || sub.namaRuangan}
                              </div>
                              <div className="text-sm font-mono text-stone-500">
                                {sub.kodeRuangan}
                              </div>
                            </td>
                            <td className="py-3.5 px-5 text-stone-700">
                              <div>{sub.penanggungJawab}</div>
                            </td>
                            <td className="py-3.5 px-5 text-right font-mono tabular-nums text-stone-900 whitespace-nowrap">
                              {subStats.totalUnit} unit
                            </td>
                            <td className="py-3.5 px-5 text-right text-sm whitespace-nowrap">
                              <span className="text-[#166534] font-medium">
                                {subStats.baik} Baik
                              </span>
                              {rusakSub > 0 && (
                                <span className="text-[#9A3412] font-medium ml-2">
                                  · {rusakSub} Rusak
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-4 text-sm font-medium">
                                <button
                                  type="button"
                                  onClick={() => onNavigate('barang', sub.id)}
                                  className="text-stone-700 hover:text-stone-900 hover:underline cursor-pointer"
                                >
                                  Lihat Barang
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onNavigate('laporan', sub.id)}
                                  className="text-[#0F5C4D] hover:underline cursor-pointer"
                                >
                                  Cetak KIR
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                </tbody>
              </table>
            </div>

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
              pageSizeOptions={[5, 10, 25]}
              itemLabel="ruangan induk"
            />
          </>
        )}
      </section>

      {/* Quiet Recent Mutations Section (Simple, No Clutter) */}
      <section className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg font-semibold text-stone-900">
            Mutasi Barang Terakhir
          </h2>
          <div className="flex items-center gap-5 text-sm font-medium">
            <button
              type="button"
              onClick={onOpenAddMutasi}
              className="text-[#0F5C4D] hover:underline cursor-pointer"
            >
              + Catat Mutasi
            </button>
            <button
              type="button"
              onClick={() => onNavigate('mutasi')}
              className="text-stone-700 hover:underline cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>
        </div>

        {mutasiList.length === 0 ? (
          <p className="text-[15px] text-stone-500 py-2">
            Belum ada catatan perpindahan atau mutasi barang.
          </p>
        ) : (
          <div className="divide-y divide-stone-200 border-t border-stone-200">
            {mutasiList.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
              >
                <div>
                  <div className="text-[15px] font-medium text-stone-900">
                    {m.namaBarang}
                  </div>
                  <div className="text-sm text-stone-600 mt-0.5">
                    {m.ruanganAsalNama} → {m.ruanganTujuanNama}
                  </div>
                </div>
                <div className="text-sm text-stone-500 sm:text-right shrink-0">
                  <div className="font-mono">{m.tanggalMutasi}</div>
                  <div>{m.nomorBeritaAcara}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
