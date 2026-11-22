export const RESET_CONFIRMATION_PHRASE = 'HAPUS SEMUA';
export const FIRESTORE_SAFE_BATCH_LIMIT = 400;

export interface ResetDataSummary {
  deletedRuangan: number;
  deletedBarang: number;
  deletedMutasi: number;
  totalDeleted: number;
}

/**
 * Validates that the user explicitly typed the destructive confirmation phrase.
 */
export function isResetConfirmationValid(input: string): boolean {
  return input.trim().toUpperCase() === RESET_CONFIRMATION_PHRASE;
}

/**
 * Splits an array into chunks that fit comfortably under Firestore's 500-op WriteBatch limit.
 */
export function chunkForFirestoreBatch<T>(
  items: T[],
  maxBatchSize: number = FIRESTORE_SAFE_BATCH_LIMIT
): T[][] {
  const safeLimit = Math.min(500, Math.max(1, Math.floor(maxBatchSize) || FIRESTORE_SAFE_BATCH_LIMIT));
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeLimit) {
    chunks.push(items.slice(i, i + safeLimit));
  }
  return chunks;
}

/**
 * Produces a clear Indonesian summary after resetting Firebase collections.
 */
export function formatResetSummaryMessage(summary: ResetDataSummary): string {
  if (summary.totalDeleted === 0) {
    return 'Database Firebase sudah dalam keadaan kosong. Anda dapat langsung mulai mengisi data ruangan dan barang dari awal.';
  }
  return `Database Firebase berhasil dikosongkan (${summary.deletedRuangan} ruangan, ${summary.deletedBarang} barang, dan ${summary.deletedMutasi} riwayat mutasi dihapus). Anda kini dapat mulai mengisi data dari awal.`;
}
