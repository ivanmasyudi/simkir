import { Barang, KondisiBarang, Mutasi, Ruangan } from '../types/kir';
import { resolveBarangRoom } from './kirLogic';

export type SortDirection = 'asc' | 'desc';

export type BarangSortKey =
  | 'default'
  | 'namaBarang'
  | 'tahunPerolehan'
  | 'ruangan'
  | 'jumlah'
  | 'kondisi';

export type MutasiSortKey =
  | 'tanggalMutasi'
  | 'namaBarang'
  | 'nomorBeritaAcara';

export interface PaginationResult<T> {
  pageItems: T[];
  safePage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  startDisplay: number;
  endDisplay: number;
}

/**
 * Pure pagination slicing with safe bounds clamping.
 * Handles empty lists, deleted trailing pages, and invalid page numbers safely.
 */
export function paginateItems<T>(
  items: T[],
  currentPage: number,
  pageSize: number
): PaginationResult<T> {
  const totalItems = items.length;
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 10));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const requestedPage = Math.floor(Number(currentPage) || 1);
  const safePage = Math.min(Math.max(1, requestedPage), totalPages);

  if (totalItems === 0) {
    return {
      pageItems: [],
      safePage: 1,
      pageSize: safePageSize,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      startDisplay: 0,
      endDisplay: 0,
    };
  }

  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);
  const pageItems = items.slice(startIndex, endIndex);

  return {
    pageItems,
    safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    startDisplay: startIndex + 1,
    endDisplay: endIndex,
  };
}

/**
 * Builds a compact, senior-friendly page number sequence with ellipsis.
 * Always keeps first page, last page, and immediate neighbors around currentPage.
 */
export function buildPageNumbers(
  currentPage: number,
  totalPages: number
): Array<number | 'ellipsis'> {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage)), safeTotal);

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  const pages: Array<number | 'ellipsis'> = [1];
  const windowStart = Math.max(2, safeCurrent - 1);
  const windowEnd = Math.min(safeTotal - 1, safeCurrent + 1);

  if (windowStart > 2) {
    pages.push('ellipsis');
  }

  for (let p = windowStart; p <= windowEnd; p++) {
    pages.push(p);
  }

  if (windowEnd < safeTotal - 1) {
    pages.push('ellipsis');
  }

  pages.push(safeTotal);
  return pages;
}

const KONDISI_RANK: Record<KondisiBarang, number> = {
  Baik: 1,
  'Kurang Baik': 2,
  'Rusak Berat': 3,
};

/**
 * Immutable, locale-aware sorting for Master Barang table.
 */
export function sortBarangList(
  items: Barang[],
  sortBy: BarangSortKey,
  sortDir: SortDirection,
  ruanganList: Ruangan[]
): Barang[] {
  if (sortBy === 'default') {
    return items;
  }

  const factor = sortDir === 'asc' ? 1 : -1;
  const roomLabelCache = new Map<string, string>();
  const getRoomLabel = (item: Barang): string => {
    const key = `${item.ruanganId}|${item.ruanganNama}`;
    let label = roomLabelCache.get(key);
    if (label === undefined) {
      const resolved = resolveBarangRoom(item, ruanganList);
      label = `${resolved.parentName} ${resolved.subName}`.trim().toLowerCase();
      roomLabelCache.set(key, label);
    }
    return label;
  };

  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'namaBarang':
        cmp = a.namaBarang.localeCompare(b.namaBarang, 'id', {
          sensitivity: 'base',
        });
        break;
      case 'tahunPerolehan':
        cmp = (Number(a.tahunPerolehan) || 0) - (Number(b.tahunPerolehan) || 0);
        break;
      case 'ruangan':
        cmp = getRoomLabel(a).localeCompare(getRoomLabel(b), 'id', {
          sensitivity: 'base',
        });
        break;
      case 'jumlah':
        cmp = (Number(a.jumlah) || 0) - (Number(b.jumlah) || 0);
        break;
      case 'kondisi':
        cmp = (KONDISI_RANK[a.kondisi] ?? 99) - (KONDISI_RANK[b.kondisi] ?? 99);
        break;
      default:
        cmp = 0;
    }

    if (cmp !== 0) {
      return cmp * factor;
    }

    return a.namaBarang.localeCompare(b.namaBarang, 'id', {
      sensitivity: 'base',
    });
  });
}

/**
 * Immutable sorting for Mutasi table.
 */
export function sortMutasiList(
  items: Mutasi[],
  sortBy: MutasiSortKey,
  sortDir: SortDirection
): Mutasi[] {
  const factor = sortDir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'tanggalMutasi':
        cmp = (a.tanggalMutasi || '').localeCompare(b.tanggalMutasi || '');
        if (cmp === 0) {
          cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
        }
        break;
      case 'namaBarang':
        cmp = a.namaBarang.localeCompare(b.namaBarang, 'id', {
          sensitivity: 'base',
        });
        break;
      case 'nomorBeritaAcara':
        cmp = a.nomorBeritaAcara.localeCompare(b.nomorBeritaAcara, 'id', {
          numeric: true,
          sensitivity: 'base',
        });
        break;
    }
    return cmp * factor;
  });
}
