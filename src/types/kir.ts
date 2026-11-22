export type KategoriBarang =
  | 'Elektronik & IT'
  | 'Meubelair & Furniture'
  | 'Pendingin & Tata Udara'
  | 'Alat Ukur & Laboratorium'
  | 'Kendaraan & Operasional'
  | 'Perlengkapan Kantor';

export type KondisiBarang = 'Baik' | 'Kurang Baik' | 'Rusak Berat';

export type JenisMutasi =
  | 'Perpindahan Ruangan'
  | 'Perubahan Kondisi'
  | 'Penempatan Baru';

export interface Ruangan {
  id: string;
  kodeRuangan: string;
  namaRuangan: string;
  subRuangan: string;
  gedung: string;
  lantai: string;
  penanggungJawab: string;
  nipPenanggungJawab: string;
  unitKerja: string;
  keterangan: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Barang {
  id: string;
  kodeBarang: string;
  nup: string;
  namaBarang: string;
  merkTipe: string;
  nomorSeri: string;
  ukuran: string;
  bahan: string;
  kategori: KategoriBarang;
  tahunPerolehan: number;
  sumberDana: string;
  jumlah: number;
  satuan: string;
  kondisi: KondisiBarang;
  ruanganId: string;
  ruanganNama: string;
  keterangan: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mutasi {
  id: string;
  nomorBeritaAcara: string;
  tanggalMutasi: string;
  jenisMutasi: JenisMutasi;
  barangId: string;
  kodeBarang: string;
  namaBarang: string;
  ruanganAsalId: string;
  ruanganAsalNama: string;
  ruanganTujuanId: string;
  ruanganTujuanNama: string;
  kondisiAwal: KondisiBarang;
  kondisiAkhir: KondisiBarang;
  petugasInput: string;
  alasanMutasi: string;
  ownerId: string;
  createdAt: string;
}

export interface InstansiSetting {
  propinsi: string;
  kotaKab: string;
  unit: string;
  satuanKerja: string;
  kodeLokasi: string;
  tahunPelaporan: string;
  halaman: string;
  logoUrl: string;
  namaKepalaUnit: string;
  nipKepalaUnit: string;
  namaPengurusBarang: string;
  nipPengurusBarang: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'barang'
  | 'ruangan'
  | 'mutasi'
  | 'qr-label'
  | 'laporan'
  | 'pengaturan';
