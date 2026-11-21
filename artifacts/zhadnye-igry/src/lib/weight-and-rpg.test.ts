import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_ENTRY,
  normalizeDecimalInput,
  readEntriesWithStatus,
  STORAGE_KEY,
  validateJournalEntry,
  type JournalEntry,
  type JournalStorage,
} from './journal-storage.ts';
import {
  deleteWeight,
  EMPTY_WEIGHT,
  getCombinedWeightHistory,
  persistWeights,
  readWeightsWithStatus,
  upsertWeight,
  validateWeightMeasurement,
  WEIGHT_STORAGE_KEY,
  type WeightMeasurement,
} from './weight-storage.ts';
import {
  CHARACTER_STORAGE_KEY,
  computeDomainSnapshots,
  createBackupSnapshot,
  DEFAULT_CHARACTER,
  deleteGoal,
  parseBackupSnapshot,
  persistCharacter,
  persistGoals,
  readCharacterWithStatus,
  readGoalsWithStatus,
  upsertGoal,
  type GoalItem,
} from './rpg-storage.ts';

class MemoryStorage implements JournalStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('Russian iOS decimal comma is normalized and validated safely', () => {
  assert.equal(normalizeDecimalInput(' 82,4 '), '82.4');

  const check = validateJournalEntry({
    ...EMPTY_ENTRY,
    date: '2026-11-21',
    sleepHours: '7,5',
    cigarettes: '0',
  });
  assert.equal(check.valid, true);
  assert.equal(check.normalized.sleepHours, '7.5');
  assert.equal(check.normalized.cigarettes, '0');

  const bad = validateJournalEntry({
    ...EMPTY_ENTRY,
    date: '2026-11-21',
    sleepHours: '30',
    cigarettes: '-2',
  });
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.length, 2);
});

test('readEntriesWithStatus flags corrupted JSON without destroying raw payload', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '{corrupted');
  const res = readEntriesWithStatus(storage);
  assert.equal(res.corrupted, true);
  assert.equal(res.rawValue, '{corrupted');
  assert.deepEqual(res.entries, []);
  assert.equal(storage.getItem(STORAGE_KEY), '{corrupted');
});

test('independent weight measurements support multiple records, comma decimals, edit, delete, and legacy journal bridge', () => {
  const storage = new MemoryStorage();
  const w1Check = validateWeightMeasurement({
    ...EMPTY_WEIGHT,
    id: 'w-1',
    date: '2026-11-21',
    time: '08:15',
    weightKg: '84,6',
    context: 'morning',
  });
  assert.equal(w1Check.valid, true);
  assert.equal(w1Check.normalized.weightKg, '84.6');

  const w2: WeightMeasurement = {
    ...EMPTY_WEIGHT,
    id: 'w-2',
    date: '2026-11-21',
    time: '21:30',
    weightKg: '85.1',
    context: 'evening',
  };

  let list = upsertWeight([], w1Check.normalized);
  list = upsertWeight(list, w2);
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'w-2');

  assert.equal(persistWeights(list, storage), true);
  const reloaded = readWeightsWithStatus(storage);
  assert.equal(reloaded.corrupted, false);
  assert.equal(reloaded.measurements.length, 2);

  // Legacy bridge: includes journal weight on date without manual weight, skips date that already has manual weight
  const journal: JournalEntry[] = [
    { ...EMPTY_ENTRY, date: '2026-11-21', weightKg: '84.9' },
    { ...EMPTY_ENTRY, date: '2026-11-18', weightKg: '85.5' },
  ];
  const combined = getCombinedWeightHistory(reloaded.measurements, journal);
  assert.equal(combined.length, 3);
  assert.equal(combined[2].date, '2026-11-18');
  assert.equal(combined[2].source, 'journal-legacy');

  const afterDelete = deleteWeight(reloaded.measurements, 'w-2');
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'w-1');

  // Corrupt weight storage detection
  storage.setItem(WEIGHT_STORAGE_KEY, 'not-json');
  assert.equal(readWeightsWithStatus(storage).corrupted, true);
});

test('character profile, goals, and honest domain snapshots distinguish confirmed facts, self-assessment, and unknown', () => {
  const storage = new MemoryStorage();
  const profile = {
    ...DEFAULT_CHARACTER,
    displayName: 'Иван',
    values: ['Ясность', 'Здоровье'],
    inventory: [{ id: 'inv-1', name: 'Кроссовки для ходьбы', condition: 'рабочие', note: '' }],
  };
  assert.equal(persistCharacter(profile, storage), true);
  const loadedProfile = readCharacterWithStatus(storage);
  assert.equal(loadedProfile.corrupted, false);
  assert.equal(loadedProfile.profile.displayName, 'Иван');
  assert.equal(loadedProfile.profile.inventory.length, 1);

  const goal: GoalItem = {
    id: 'g-1',
    title: 'Регулярный сон',
    domainId: 'recovery',
    nextStep: 'Ложиться до 23:30 три дня подряд',
    status: 'active',
    createdAt: '2026-11-20',
    updatedAt: '2026-11-21',
  };
  const goals = upsertGoal([], goal);
  assert.equal(persistGoals(goals, storage), true);
  assert.equal(readGoalsWithStatus(storage).goals.length, 1);
  assert.equal(deleteGoal(goals, 'g-1').length, 0);

  // Domain snapshot check: today has only notes, yesterday had sleep -> recovery still finds yesterday's confirmed sleep!
  const entries: JournalEntry[] = [
    { ...EMPTY_ENTRY, date: '2026-11-21', notes: 'Спокойный день' },
    { ...EMPTY_ENTRY, date: '2026-11-20', sleepHours: '7.5', sleepQuality: '4' },
  ];
  const weights: WeightMeasurement[] = [
    { ...EMPTY_WEIGHT, id: 'w-a', date: '2026-11-21', weightKg: '83.2' },
    { ...EMPTY_WEIGHT, id: 'w-b', date: '2026-11-19', weightKg: '84.0' },
  ];

  const snapshots = computeDomainSnapshots(entries, weights, goals, '2026-11-21');
  const recovery = snapshots.find((s) => s.domain.id === 'recovery')!;
  const body = snapshots.find((s) => s.domain.id === 'body')!;
  const craft = snapshots.find((s) => s.domain.id === 'craft')!;

  assert.equal(recovery.epistemicStatus, 'confirmed');
  assert.equal(recovery.latestConfirmed?.value, '7.5 ч');
  assert.equal(recovery.latestConfirmed?.date, '2026-11-20');
  assert.equal(recovery.latestSelfAssessment?.value, '4 / 5');
  assert.equal(recovery.activeGoalsCount, 1);

  assert.equal(body.epistemicStatus, 'confirmed');
  assert.equal(body.latestConfirmed?.value, '83.2 кг');
  assert.equal(body.deltaLabel, '-0.8 кг к прошлому');

  // Craft has no entries -> explicitly unknown, never fabricated!
  assert.equal(craft.epistemicStatus, 'unknown');
  assert.equal(craft.latestConfirmed, null);

  // Backup round-trip & sanitization of invalid items inside JSON
  const backup = createBackupSnapshot(entries, weights, profile, goals);
  const parsed = parseBackupSnapshot(JSON.stringify(backup));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.snapshot?.weights.length, 2);

  const dirtyBackup = JSON.stringify({
    version: 1,
    exportedAt: '2026-11-21T00:00:00Z',
    journal: [
      { date: '2026-11-21', sleepHours: '7.5' },
      { date: 'bad-date', sleepHours: '8' },
    ],
    weights: [
      { id: 'w-ok', date: '2026-11-21', weightKg: '82.1' },
      { id: '', date: '2026-11-21', weightKg: '' },
    ],
    character: { displayName: 'Тест' },
    goals: [{ id: 'g-ok', title: 'Сон', domainId: 'invalid-domain', status: 'active' }],
  });
  const sanitized = parseBackupSnapshot(dirtyBackup);
  assert.equal(sanitized.valid, true);
  assert.equal(sanitized.snapshot?.journal.length, 1);
  assert.equal(sanitized.snapshot?.weights.length, 1);
  assert.equal(sanitized.snapshot?.goals[0].domainId, 'craft');

  const badVersion = parseBackupSnapshot(JSON.stringify({ version: 99 }));
  assert.equal(badVersion.valid, false);

  storage.setItem(CHARACTER_STORAGE_KEY, '{bad');
  assert.equal(readCharacterWithStatus(storage).corrupted, true);
});

