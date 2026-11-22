import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkForFirestoreBatch,
  formatResetSummaryMessage,
  isResetConfirmationValid,
} from './firebaseReset';

test('isResetConfirmationValid accepts exact phrase regardless of case or surrounding whitespace', () => {
  assert.equal(isResetConfirmationValid('HAPUS SEMUA'), true);
  assert.equal(isResetConfirmationValid('  hapus semua  '), true);
  assert.equal(isResetConfirmationValid('Hapus Semua'), true);
  assert.equal(isResetConfirmationValid('HAPUS'), false);
  assert.equal(isResetConfirmationValid(''), false);
});

test('chunkForFirestoreBatch splits large arrays safely below Firestore 500-op batch limit', () => {
  assert.deepEqual(chunkForFirestoreBatch([]), []);

  const small = [1, 2, 3];
  assert.deepEqual(chunkForFirestoreBatch(small, 400), [[1, 2, 3]]);

  const large = Array.from({ length: 950 }, (_, i) => i + 1);
  const chunks = chunkForFirestoreBatch(large, 400);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 400);
  assert.equal(chunks[1].length, 400);
  assert.equal(chunks[2].length, 150);
  assert.equal(chunks.flat().length, 950);

  // Clamps maxBatchSize > 500 down to 500
  const clamped = chunkForFirestoreBatch(large, 900);
  assert.equal(clamped.length, 2);
  assert.equal(clamped[0].length, 500);
  assert.equal(clamped[1].length, 450);
});

test('formatResetSummaryMessage formats empty and non-empty reset results clearly in Indonesian', () => {
  const emptyMsg = formatResetSummaryMessage({
    deletedRuangan: 0,
    deletedBarang: 0,
    deletedMutasi: 0,
    totalDeleted: 0,
  });
  assert.match(emptyMsg, /sudah dalam keadaan kosong/i);

  const nonEmptyMsg = formatResetSummaryMessage({
    deletedRuangan: 6,
    deletedBarang: 24,
    deletedMutasi: 4,
    totalDeleted: 34,
  });
  assert.match(nonEmptyMsg, /6 ruangan/);
  assert.match(nonEmptyMsg, /24 barang/);
  assert.match(nonEmptyMsg, /4 riwayat mutasi/);
});
