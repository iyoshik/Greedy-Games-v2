import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteEntry,
  persistEntries,
  readEntriesWithStatus,
  upsertEntry,
  type JournalEntry,
} from '@/lib/journal-storage';
import {
  deleteWeight,
  getCombinedWeightHistory,
  persistWeights,
  readWeightsWithStatus,
  upsertWeight,
  type WeightMeasurement,
} from '@/lib/weight-storage';
import {
  computeDomainSnapshots,
  createBackupSnapshot,
  deleteGoal,
  parseBackupSnapshot,
  persistCharacter,
  persistGoals,
  readCharacterWithStatus,
  readGoalsWithStatus,
  upsertGoal,
  type CharacterProfile,
  type GoalItem,
} from '@/lib/rpg-storage';
import { todayIso } from '@/lib/date-utils';

export type CorruptionNotice = {
  journal: boolean;
  weights: boolean;
  character: boolean;
  goals: boolean;
};

export function useGameStore() {
  const initialJournal = useMemo(() => readEntriesWithStatus(), []);
  const initialWeights = useMemo(() => readWeightsWithStatus(), []);
  const initialCharacter = useMemo(() => readCharacterWithStatus(), []);
  const initialGoals = useMemo(() => readGoalsWithStatus(), []);

  const [entries, setEntries] = useState<JournalEntry[]>(initialJournal.entries);
  const [weights, setWeights] = useState<WeightMeasurement[]>(initialWeights.measurements);
  const [character, setCharacter] = useState<CharacterProfile>(initialCharacter.profile);
  const [goals, setGoals] = useState<GoalItem[]>(initialGoals.goals);

  const [corrupted, setCorrupted] = useState<CorruptionNotice>({
    journal: initialJournal.corrupted,
    weights: initialWeights.corrupted,
    character: initialCharacter.corrupted,
    goals: initialGoals.corrupted,
  });

  const [storageWarning, setStorageWarning] = useState('');

  // Track whether each slice has been explicitly modified by user action.
  // Never overwrite storage on initial mount if the stored payload was corrupted!
  const dirtyRef = useRef({
    journal: false,
    weights: false,
    character: false,
    goals: false,
  });

  useEffect(() => {
    if (!dirtyRef.current.journal) return;
    const ok = persistEntries(entries);
    if (!ok) {
      setStorageWarning(
        'Не удалось сохранить записи дневника в этом браузере. Проверь свободное место и настройки Safari.',
      );
    } else {
      setStorageWarning('');
    }
  }, [entries]);

  useEffect(() => {
    if (!dirtyRef.current.weights) return;
    const ok = persistWeights(weights);
    if (!ok) {
      setStorageWarning(
        'Не удалось сохранить измерения веса в этом браузере. Проверь свободное место и настройки Safari.',
      );
    } else {
      setStorageWarning('');
    }
  }, [weights]);

  useEffect(() => {
    if (!dirtyRef.current.character) return;
    const ok = persistCharacter(character);
    if (!ok) {
      setStorageWarning('Не удалось сохранить профиль персонажа в этом браузере.');
    } else {
      setStorageWarning('');
    }
  }, [character]);

  useEffect(() => {
    if (!dirtyRef.current.goals) return;
    const ok = persistGoals(goals);
    if (!ok) {
      setStorageWarning('Не удалось сохранить цели в этом браузере.');
    } else {
      setStorageWarning('');
    }
  }, [goals]);

  const saveEntry = useCallback((entry: JournalEntry, previousDate = '') => {
    dirtyRef.current.journal = true;
    setCorrupted((prev) => ({ ...prev, journal: false }));
    setEntries((current) => upsertEntry(current, entry, previousDate));
  }, []);

  const removeEntry = useCallback((date: string) => {
    dirtyRef.current.journal = true;
    setEntries((current) => deleteEntry(current, date));
  }, []);

  const saveWeight = useCallback((measurement: WeightMeasurement) => {
    dirtyRef.current.weights = true;
    setCorrupted((prev) => ({ ...prev, weights: false }));
    setWeights((current) => upsertWeight(current, measurement));
  }, []);

  const removeWeight = useCallback((id: string) => {
    dirtyRef.current.weights = true;
    setWeights((current) => deleteWeight(current, id));
  }, []);

  const saveCharacter = useCallback((profile: CharacterProfile) => {
    dirtyRef.current.character = true;
    setCorrupted((prev) => ({ ...prev, character: false }));
    setCharacter({ ...profile, updatedAt: new Date().toISOString() });
  }, []);

  const saveGoal = useCallback((goal: GoalItem) => {
    dirtyRef.current.goals = true;
    setCorrupted((prev) => ({ ...prev, goals: false }));
    setGoals((current) => upsertGoal(current, goal));
  }, []);

  const removeGoal = useCallback((id: string) => {
    dirtyRef.current.goals = true;
    setGoals((current) => deleteGoal(current, id));
  }, []);

  const combinedWeights = useMemo(
    () => getCombinedWeightHistory(weights, entries),
    [weights, entries],
  );

  const domainSnapshots = useMemo(
    () => computeDomainSnapshots(entries, weights, goals, todayIso()),
    [entries, weights, goals],
  );

  const exportBackupJson = useCallback(() => {
    return JSON.stringify(
      createBackupSnapshot(entries, weights, character, goals),
      null,
      2,
    );
  }, [entries, weights, character, goals]);

  const importBackupJson = useCallback(
    (rawJson: string): { ok: boolean; message: string } => {
      const parsed = parseBackupSnapshot(rawJson);
      if (!parsed.valid || !parsed.snapshot) {
        return { ok: false, message: parsed.error ?? 'Ошибка формата резервной копии.' };
      }

      const snap = parsed.snapshot;
      dirtyRef.current = { journal: true, weights: true, character: true, goals: true };
      setEntries(snap.journal);
      setWeights(snap.weights);
      setCharacter(snap.character);
      setGoals(snap.goals);
      setCorrupted({ journal: false, weights: false, character: false, goals: false });

      return {
        ok: true,
        message: `Импортировано: записей дневника — ${snap.journal.length}, замеров веса — ${snap.weights.length}, целей — ${snap.goals.length}.`,
      };
    },
    [],
  );

  const hasCorruption =
    corrupted.journal || corrupted.weights || corrupted.character || corrupted.goals;

  return {
    entries,
    weights,
    combinedWeights,
    character,
    goals,
    domainSnapshots,
    storageWarning,
    corrupted,
    hasCorruption,
    saveEntry,
    removeEntry,
    saveWeight,
    removeWeight,
    saveCharacter,
    saveGoal,
    removeGoal,
    exportBackupJson,
    importBackupJson,
  };
}

export type GameStore = ReturnType<typeof useGameStore>;
