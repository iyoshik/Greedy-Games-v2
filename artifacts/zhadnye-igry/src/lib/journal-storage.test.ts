import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deleteEntry,
  EMPTY_ENTRY,
  persistEntries,
  readEntries,
  STORAGE_KEY,
  upsertEntry,
  type JournalEntry,
  type JournalStorage,
} from './journal-storage.ts';

class MemoryStorage implements JournalStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const entry = (date: string, values: Partial<JournalEntry> = {}): JournalEntry => ({
  ...EMPTY_ENTRY,
  date,
  ...values,
});

test('adding a record preserves zero and leaves missing values blank after reload', () => {
  const storage = new MemoryStorage();
  const added = upsertEntry([], entry('2026-10-30', { cigarettes: '0', sleepHours: '' }));

  assert.equal(added.length, 1);
  assert.equal(persistEntries(added, storage), true);
  const afterReload = readEntries(storage);

  assert.equal(afterReload.length, 1);
  assert.equal(afterReload[0].cigarettes, '0');
  assert.equal(afterReload[0].sleepHours, '');
  assert.deepEqual(afterReload.map(({ date }) => date), ['2026-10-30']);
});

test('editing a record replaces its values without creating a duplicate date', () => {
  const first = entry('2026-10-30', { sleepHours: '6' });
  const edited = entry('2026-10-30', { sleepHours: '8', notes: 'Обновлено' });
  const records = upsertEntry([first], edited, first.date);

  assert.equal(records.length, 1);
  assert.equal(records[0].sleepHours, '8');
  assert.equal(records[0].notes, 'Обновлено');
});

test('changing the date while editing moves the existing record', () => {
  const original = entry('2026-10-30', { walkingMinutes: '20' });
  const moved = upsertEntry([original], entry('2026-10-29', { walkingMinutes: '45' }), original.date);

  assert.deepEqual(moved.map(({ date }) => date), ['2026-10-29']);
  assert.equal(moved[0].walkingMinutes, '45');
});

test('deletion removes the selected record and persists the empty history after reload', () => {
  const storage = new MemoryStorage();
  const remaining = deleteEntry([
    entry('2026-10-30', { notes: 'Удалить' }),
    entry('2026-10-29', { notes: 'Оставить' }),
  ], '2026-10-30');

  assert.equal(remaining.length, 1);
  assert.equal(persistEntries(remaining, storage), true);
  assert.deepEqual(readEntries(storage).map(({ date }) => date), ['2026-10-29']);

  const empty = deleteEntry(readEntries(storage), '2026-10-29');
  assert.equal(persistEntries(empty, storage), true);
  assert.deepEqual(readEntries(storage), []);
});

test('unreadable storage does not fabricate records', () => {
  const storage: JournalStorage = {
    getItem: () => '{not valid json',
    setItem: () => undefined,
  };
  assert.deepEqual(readEntries(storage), []);
  assert.equal(storage.getItem(STORAGE_KEY), '{not valid json');
});
