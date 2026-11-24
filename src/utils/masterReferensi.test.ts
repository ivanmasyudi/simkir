import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultMasterReferensiList,
  findMatchingMasterValue,
  getEffectiveMasterOptions,
  getMissingDefaultSeeds,
  MASTER_REFERENSI_TABS,
  validateMasterReferensiInput,
} from './masterReferensi';
import { MasterReferensi } from '../types/kir';

test('MASTER_REFERENSI_TABS covers satuan, bahan, ukuran, merk, and katalog', () => {
  assert.deepEqual(
    MASTER_REFERENSI_TABS.map((t) => t.jenis),
    ['satuan', 'bahan', 'ukuran', 'merk', 'katalog']
  );
});

test('getEffectiveMasterOptions falls back to defaults when user list is empty and uses user list exclusively once populated', () => {
  const defaultsSatuan = getEffectiveMasterOptions([], 'satuan');
  assert.ok(defaultsSatuan.length >= 4);
  assert.ok(defaultsSatuan.some((s) => s.nama === 'UNIT'));

  const customList: MasterReferensi[] = [
    {
      id: 'ref-satuan-custom-1',
      jenis: 'satuan',
      nama: 'DOS',
      kode: '',
      keterangan: '',
      ownerId: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'ref-satuan-custom-2',
      jenis: 'satuan',
      nama: 'BOTOL',
      kode: '',
      keterangan: '',
      ownerId: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const effective = getEffectiveMasterOptions(customList, 'satuan');
  assert.deepEqual(
    effective.map((i) => i.nama),
    ['BOTOL', 'DOS']
  );
  // Other jenis still gracefully falls back to defaults
  assert.ok(getEffectiveMasterOptions(customList, 'bahan').length >= 5);
});

test('validateMasterReferensiInput enforces required fields, katalog kode, and duplicate guard', () => {
  const existing = buildDefaultMasterReferensiList('u1');

  assert.equal(
    validateMasterReferensiInput({ jenis: 'bahan', nama: '' }, existing).valid,
    false
  );
  assert.equal(
    validateMasterReferensiInput({ jenis: 'bahan', nama: 'besi' }, existing).valid,
    false
  );
  // Editing the same item ID is allowed
  const besiItem = existing.find((x) => x.jenis === 'bahan' && x.nama === 'BESI')!;
  assert.equal(
    validateMasterReferensiInput(
      { jenis: 'bahan', nama: 'BESI', keterangan: 'Diperbarui' },
      existing,
      besiItem.id
    ).valid,
    true
  );
  // Katalog requires kode
  assert.equal(
    validateMasterReferensiInput({ jenis: 'katalog', nama: 'MESIN USG', kode: '' }, existing)
      .valid,
    false
  );
  assert.equal(
    validateMasterReferensiInput(
      { jenis: 'katalog', nama: 'MESIN USG', kode: '1.3.2.07.01.02.010' },
      existing
    ).valid,
    true
  );
});

test('getMissingDefaultSeeds skips already existing names case-insensitively', () => {
  const existing: MasterReferensi[] = [
    {
      id: 'ref-1',
      jenis: 'satuan',
      nama: 'unit',
      kode: '',
      keterangan: '',
      ownerId: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const missingSatuan = getMissingDefaultSeeds(existing, 'u1', 'satuan');
  assert.equal(
    missingSatuan.some((s) => s.nama.toLowerCase() === 'unit'),
    false
  );
  assert.ok(missingSatuan.some((s) => s.nama === 'SET'));
});

test('findMatchingMasterValue matches case-insensitively and returns null for custom values', () => {
  const bahanOpts = getEffectiveMasterOptions([], 'bahan');
  assert.equal(findMatchingMasterValue('besi', bahanOpts), 'BESI');
  assert.equal(findMatchingMasterValue('titanium khusus', bahanOpts), null);
  assert.equal(findMatchingMasterValue('', bahanOpts), null);
});
