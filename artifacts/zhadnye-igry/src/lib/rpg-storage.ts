import {
  parseFiniteNumber,
  readEntriesWithStatus,
  STORAGE_KEY,
  type JournalEntry,
  type JournalStorage,
} from './journal-storage.ts';
import {
  getCombinedWeightHistory,
  readWeightsWithStatus,
  WEIGHT_STORAGE_KEY,
  type WeightMeasurement,
} from './weight-storage.ts';

export type DomainId = 'recovery' | 'body' | 'craft' | 'resilience' | 'chronicle';
export type EpistemicStatus = 'confirmed' | 'self-assessment' | 'unknown';
export type GoalStatus = 'active' | 'paused' | 'completed';

export type InventoryItem = {
  id: string;
  name: string;
  condition: string;
  note: string;
};

export type CharacterProfile = {
  displayName: string;
  title: string;
  identityNote: string;
  values: string[];
  constraints: string;
  inventory: InventoryItem[];
  onboardingDismissed: boolean;
  updatedAt: string;
};

export type GoalItem = {
  id: string;
  title: string;
  domainId: DomainId;
  nextStep: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
};

export type DevelopmentDomainDefinition = {
  id: DomainId;
  name: string;
  shortLabel: string;
  realLifeInputs: string;
  description: string;
};

export type DomainObservation = {
  domain: DevelopmentDomainDefinition;
  epistemicStatus: EpistemicStatus;
  latestConfirmed: { label: string; value: string; date: string } | null;
  latestSelfAssessment: { label: string; value: string; date: string } | null;
  deltaLabel: string | null;
  recordsLast7Days: number;
  totalConfirmedRecords: number;
  activeGoalsCount: number;
  rpgSlotNote: string;
};

export type BackupSnapshot = {
  version: 1;
  exportedAt: string;
  journal: JournalEntry[];
  weights: WeightMeasurement[];
  character: CharacterProfile;
  goals: GoalItem[];
};

export const CHARACTER_STORAGE_KEY = 'zhadnye-igry-character-v1';
export const GOALS_STORAGE_KEY = 'zhadnye-igry-goals-v1';

export const DEFAULT_CHARACTER: CharacterProfile = {
  displayName: 'Усатый ЖИФ',
  title: 'Путник личных земель',
  identityNote: '',
  values: [],
  constraints: '',
  inventory: [],
  onboardingDismissed: false,
  updatedAt: '',
};

export const DEVELOPMENT_DOMAINS: DevelopmentDomainDefinition[] = [
  {
    id: 'recovery',
    name: 'Восстановление и сон',
    shortLabel: 'Восстановление',
    realLifeInputs: 'Длительность сна (факт), качество сна и энергия (самооценка)',
    description: 'Режим отдыха и фактический ресурс восстановления.',
  },
  {
    id: 'body',
    name: 'Тело и движение',
    shortLabel: 'Тело',
    realLifeInputs: 'Отдельные измерения веса, минуты прогулок и движения',
    description: 'Физическое состояние, вес и повседневная подвижность.',
  },
  {
    id: 'craft',
    name: 'Дело и мастерство',
    shortLabel: 'Дело',
    realLifeInputs: 'Время работы над проектом, задачи и рабочий фокус',
    description: 'Реальный вклад времени в проекты, ремесло и доход.',
  },
  {
    id: 'resilience',
    name: 'Стойкость и привычки',
    shortLabel: 'Стойкость',
    realLifeInputs: 'Трезвость и количество сигарет по дням',
    description: 'Честная фиксация привычек без штрафов и наказаний.',
  },
  {
    id: 'chronicle',
    name: 'Осознанность и хроника',
    shortLabel: 'Хроника',
    realLifeInputs: 'Текстовые наблюдения и регулярность ведения журнала',
    description: 'Накопленная история реальных дней и контекст решений.',
  },
];

export function getDomainById(id: DomainId): DevelopmentDomainDefinition {
  return DEVELOPMENT_DOMAINS.find((d) => d.id === id) ?? DEVELOPMENT_DOMAINS[0];
}

export function createEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function readCharacterWithStatus(storage?: JournalStorage): {
  profile: CharacterProfile;
  corrupted: boolean;
  rawValue: string | null;
} {
  let raw: string | null = null;
  try {
    raw = (storage ?? window.localStorage).getItem(CHARACTER_STORAGE_KEY);
  } catch {
    return { profile: { ...DEFAULT_CHARACTER }, corrupted: true, rawValue: null };
  }

  if (!raw) {
    return { profile: { ...DEFAULT_CHARACTER }, corrupted: false, rawValue: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { profile: { ...DEFAULT_CHARACTER }, corrupted: true, rawValue: raw };
    }
    const record = parsed as Record<string, unknown>;
    const values = Array.isArray(record.values)
      ? record.values.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      : [];
    const inventory: InventoryItem[] = Array.isArray(record.inventory)
      ? record.inventory
          .filter(
            (item): item is Record<string, unknown> =>
              item !== null &&
              typeof item === 'object' &&
              typeof item.name === 'string' &&
              item.name.trim() !== '',
          )
          .map((item) => ({
            id: typeof item.id === 'string' && item.id ? item.id : createEntityId('inv'),
            name: String(item.name).trim(),
            condition: typeof item.condition === 'string' ? item.condition.trim() : '',
            note: typeof item.note === 'string' ? item.note.trim() : '',
          }))
      : [];

    return {
      profile: {
        displayName:
          typeof record.displayName === 'string' && record.displayName.trim()
            ? record.displayName.trim()
            : DEFAULT_CHARACTER.displayName,
        title:
          typeof record.title === 'string' && record.title.trim()
            ? record.title.trim()
            : DEFAULT_CHARACTER.title,
        identityNote: typeof record.identityNote === 'string' ? record.identityNote : '',
        values,
        constraints: typeof record.constraints === 'string' ? record.constraints : '',
        inventory,
        onboardingDismissed: Boolean(record.onboardingDismissed),
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
      },
      corrupted: false,
      rawValue: raw,
    };
  } catch {
    return { profile: { ...DEFAULT_CHARACTER }, corrupted: true, rawValue: raw };
  }
}

export function persistCharacter(profile: CharacterProfile, storage?: JournalStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(CHARACTER_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function readGoalsWithStatus(storage?: JournalStorage): {
  goals: GoalItem[];
  corrupted: boolean;
  rawValue: string | null;
} {
  let raw: string | null = null;
  try {
    raw = (storage ?? window.localStorage).getItem(GOALS_STORAGE_KEY);
  } catch {
    return { goals: [], corrupted: true, rawValue: null };
  }

  if (!raw) {
    return { goals: [], corrupted: false, rawValue: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { goals: [], corrupted: true, rawValue: raw };
    }

    const validDomains = new Set<DomainId>(['recovery', 'body', 'craft', 'resilience', 'chronicle']);
    const goals: GoalItem[] = parsed
      .filter(
        (item): item is Record<string, unknown> =>
          item !== null &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.title === 'string' &&
          item.title.trim() !== '',
      )
      .map((item) => ({
        id: String(item.id),
        title: String(item.title).trim(),
        domainId: validDomains.has(item.domainId as DomainId)
          ? (item.domainId as DomainId)
          : 'craft',
        nextStep: typeof item.nextStep === 'string' ? item.nextStep.trim() : '',
        status:
          item.status === 'active' || item.status === 'paused' || item.status === 'completed'
            ? item.status
            : 'active',
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
      }));

    return { goals, corrupted: false, rawValue: raw };
  } catch {
    return { goals: [], corrupted: true, rawValue: raw };
  }
}

export function persistGoals(goals: GoalItem[], storage?: JournalStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
    return true;
  } catch {
    return false;
  }
}

export function upsertGoal(goals: GoalItem[], goal: GoalItem): GoalItem[] {
  const existingIndex = goals.findIndex((g) => g.id === goal.id);
  if (existingIndex === -1) {
    return [goal, ...goals];
  }
  const next = [...goals];
  next[existingIndex] = goal;
  return next;
}

export function deleteGoal(goals: GoalItem[], id: string): GoalItem[] {
  return goals.filter((g) => g.id !== id);
}

function isWithinLastDays(dateStr: string, referenceDate: string, days: number): boolean {
  const target = new Date(`${dateStr}T12:00:00`).getTime();
  const ref = new Date(`${referenceDate}T12:00:00`).getTime();
  if (!Number.isFinite(target) || !Number.isFinite(ref)) return false;
  const diffDays = (ref - target) / 86_400_000;
  return diffDays >= -1 && diffDays < days;
}

export function formatNumericDelta(
  currentStr: string,
  previousStr: string | undefined,
  unit: string,
): string | null {
  const cur = parseFiniteNumber(currentStr);
  const prev = previousStr ? parseFiniteNumber(previousStr) : null;
  if (cur === null || prev === null) return null;
  const delta = Number((cur - prev).toFixed(1));
  if (delta === 0) return 'без изменений к прошлому замеру';
  return `${delta > 0 ? '+' : ''}${delta}${unit} к прошлому`;
}

/**
 * Computes honest, fact-grounded development domain observations without any
 * fabricated XP, levels, scores, or game formulas.
 */
export function computeDomainSnapshots(
  entries: JournalEntry[],
  weights: WeightMeasurement[],
  goals: GoalItem[],
  referenceDate: string,
): DomainObservation[] {
  const combinedWeights = getCombinedWeightHistory(weights, entries);

  const countActiveGoals = (domainId: DomainId) =>
    goals.filter((g) => g.domainId === domainId && g.status === 'active').length;

  const rpgSlotNote = 'XP и ранг: правила не утверждены';

  // 1. Recovery & Sleep
  const sleepEntries = entries.filter((e) => parseFiniteNumber(e.sleepHours) !== null);
  const sleepQualityEntries = entries.filter((e) => e.sleepQuality !== '');
  const energyEntries = entries.filter((e) => (e.energyLevel ?? '') !== '');
  const latestSleep = sleepEntries[0];
  const prevSleep = sleepEntries[1];
  const latestSleepQual = sleepQualityEntries[0];
  const latestEnergy = energyEntries[0];
  const recoverySelf = latestSleepQual
    ? { label: 'Качество сна', value: `${latestSleepQual.sleepQuality} / 5`, date: latestSleepQual.date }
    : latestEnergy
      ? { label: 'Энергия', value: `${latestEnergy.energyLevel} / 5`, date: latestEnergy.date }
      : null;

  const recoverySnapshot: DomainObservation = {
    domain: getDomainById('recovery'),
    epistemicStatus: latestSleep ? 'confirmed' : recoverySelf ? 'self-assessment' : 'unknown',
    latestConfirmed: latestSleep
      ? { label: 'Сон', value: `${latestSleep.sleepHours} ч`, date: latestSleep.date }
      : null,
    latestSelfAssessment: recoverySelf,
    deltaLabel: latestSleep ? formatNumericDelta(latestSleep.sleepHours, prevSleep?.sleepHours, ' ч') : null,
    recordsLast7Days: sleepEntries.filter((e) => isWithinLastDays(e.date, referenceDate, 7)).length,
    totalConfirmedRecords: sleepEntries.length,
    activeGoalsCount: countActiveGoals('recovery'),
    rpgSlotNote,
  };

  // 2. Body & Movement (separate weight measurements + walking)
  const latestWeight = combinedWeights[0];
  const prevWeight = combinedWeights[1];
  const walkEntries = entries.filter((e) => parseFiniteNumber(e.walkingMinutes) !== null);
  const latestWalk = walkEntries[0];
  const bodyDatesLast7 = new Set<string>([
    ...combinedWeights
      .filter((w) => isWithinLastDays(w.date, referenceDate, 7))
      .map((w) => w.date),
    ...walkEntries
      .filter((e) => isWithinLastDays(e.date, referenceDate, 7))
      .map((e) => e.date),
  ]);

  const bodyConfirmed = latestWeight
    ? { label: 'Вес', value: `${latestWeight.weightKg} кг`, date: latestWeight.date }
    : latestWalk
      ? { label: 'Прогулка', value: `${latestWalk.walkingMinutes} мин`, date: latestWalk.date }
      : null;

  const bodySecondary =
    latestWeight && latestWalk
      ? { label: 'Прогулка (факт)', value: `${latestWalk.walkingMinutes} мин`, date: latestWalk.date }
      : null;

  const bodySnapshot: DomainObservation = {
    domain: getDomainById('body'),
    epistemicStatus: bodyConfirmed ? 'confirmed' : 'unknown',
    latestConfirmed: bodyConfirmed,
    latestSelfAssessment: bodySecondary,
    deltaLabel: latestWeight
      ? formatNumericDelta(latestWeight.weightKg, prevWeight?.weightKg, ' кг')
      : latestWalk
        ? formatNumericDelta(latestWalk.walkingMinutes, walkEntries[1]?.walkingMinutes, ' мин')
        : null,
    recordsLast7Days: bodyDatesLast7.size,
    totalConfirmedRecords: combinedWeights.length + walkEntries.length,
    activeGoalsCount: countActiveGoals('body'),
    rpgSlotNote,
  };

  // 3. Craft & Project work
  const projectEntries = entries.filter((e) => parseFiniteNumber(e.projectMinutes) !== null);
  const focusEntries = entries.filter((e) => (e.workFocus ?? '').trim() !== '');
  const latestProject = projectEntries[0];
  const prevProject = projectEntries[1];
  const latestFocus = focusEntries[0];

  const craftSnapshot: DomainObservation = {
    domain: getDomainById('craft'),
    epistemicStatus: latestProject || latestFocus ? 'confirmed' : 'unknown',
    latestConfirmed: latestProject
      ? { label: 'Проект', value: `${latestProject.projectMinutes} мин`, date: latestProject.date }
      : latestFocus
        ? { label: 'Фокус дня', value: latestFocus.workFocus ?? '', date: latestFocus.date }
        : null,
    latestSelfAssessment:
      latestProject && latestFocus
        ? { label: 'Фокус', value: latestFocus.workFocus ?? '', date: latestFocus.date }
        : null,
    deltaLabel: latestProject
      ? formatNumericDelta(latestProject.projectMinutes, prevProject?.projectMinutes, ' мин')
      : null,
    recordsLast7Days: projectEntries.filter((e) => isWithinLastDays(e.date, referenceDate, 7)).length,
    totalConfirmedRecords: projectEntries.length,
    activeGoalsCount: countActiveGoals('craft'),
    rpgSlotNote,
  };

  // 4. Resilience & Habits
  const habitEntries = entries.filter(
    (e) => e.sobriety !== '' || parseFiniteNumber(e.cigarettes) !== null,
  );
  const latestHabit = habitEntries[0];
  const latestSobriety = entries.find((e) => e.sobriety !== '');
  const latestCigs = entries.find((e) => parseFiniteNumber(e.cigarettes) !== null);
  const prevCigs = entries.filter((e) => parseFiniteNumber(e.cigarettes) !== null)[1];

  const resilienceConfirmed = latestSobriety
    ? {
        label: 'Трезвость',
        value: latestSobriety.sobriety === 'yes' ? 'Да' : 'Нет',
        date: latestSobriety.date,
      }
    : latestCigs
      ? { label: 'Сигареты', value: `${latestCigs.cigarettes} шт`, date: latestCigs.date }
      : null;

  const resilienceSnapshot: DomainObservation = {
    domain: getDomainById('resilience'),
    epistemicStatus: latestHabit ? 'confirmed' : 'unknown',
    latestConfirmed: resilienceConfirmed,
    latestSelfAssessment:
      latestSobriety && latestCigs
        ? { label: 'Сигареты (факт)', value: `${latestCigs.cigarettes} шт`, date: latestCigs.date }
        : null,
    deltaLabel: latestCigs ? formatNumericDelta(latestCigs.cigarettes, prevCigs?.cigarettes, ' шт') : null,
    recordsLast7Days: habitEntries.filter((e) => isWithinLastDays(e.date, referenceDate, 7)).length,
    totalConfirmedRecords: habitEntries.length,
    activeGoalsCount: countActiveGoals('resilience'),
    rpgSlotNote,
  };

  // 5. Chronicle & Awareness
  const notesEntries = entries.filter((e) => e.notes.trim() !== '');
  const latestNote = notesEntries[0];
  const chronicleSnapshot: DomainObservation = {
    domain: getDomainById('chronicle'),
    epistemicStatus: entries.length > 0 ? 'confirmed' : 'unknown',
    latestConfirmed: latestNote
      ? {
          label: 'Последняя заметка',
          value: latestNote.notes.trim().slice(0, 64) + (latestNote.notes.trim().length > 64 ? '…' : ''),
          date: latestNote.date,
        }
      : entries[0]
        ? { label: 'Дней в хронике', value: `${entries.length}`, date: entries[0].date }
        : null,
    latestSelfAssessment: null,
    deltaLabel: entries.length > 0 ? `всего записей: ${entries.length}` : null,
    recordsLast7Days: entries.filter((e) => isWithinLastDays(e.date, referenceDate, 7)).length,
    totalConfirmedRecords: entries.length,
    activeGoalsCount: countActiveGoals('chronicle'),
    rpgSlotNote,
  };

  return [
    recoverySnapshot,
    bodySnapshot,
    craftSnapshot,
    resilienceSnapshot,
    chronicleSnapshot,
  ];
}

export function createBackupSnapshot(
  journal: JournalEntry[],
  weights: WeightMeasurement[],
  character: CharacterProfile,
  goals: GoalItem[],
): BackupSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    journal,
    weights,
    character,
    goals,
  };
}

export function parseBackupSnapshot(rawJson: string): {
  valid: boolean;
  error?: string;
  snapshot?: BackupSnapshot;
} {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Файл не является корректной резервной копией JSON.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1) {
      return { valid: false, error: 'Неподдерживаемая версия файла резервной копии.' };
    }
    if (!Array.isArray(obj.journal) || !Array.isArray(obj.weights) || !Array.isArray(obj.goals)) {
      return { valid: false, error: 'В резервной копии отсутствуют обязательные разделы данных.' };
    }
    if (!obj.character || typeof obj.character !== 'object' || Array.isArray(obj.character)) {
      return { valid: false, error: 'В резервной копии отсутствует профиль персонажа.' };
    }

    const tempMap = new Map<string, string>();
    const tempStorage: JournalStorage = {
      getItem: (k) => tempMap.get(k) ?? null,
      setItem: (k, v) => {
        tempMap.set(k, v);
      },
    };
    tempStorage.setItem(STORAGE_KEY, JSON.stringify(obj.journal));
    tempStorage.setItem(WEIGHT_STORAGE_KEY, JSON.stringify(obj.weights));
    tempStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(obj.character));
    tempStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(obj.goals));

    const cleanJournal = readEntriesWithStatus(tempStorage);
    const cleanWeights = readWeightsWithStatus(tempStorage);
    const cleanCharacter = readCharacterWithStatus(tempStorage);
    const cleanGoals = readGoalsWithStatus(tempStorage);

    if (
      cleanJournal.corrupted ||
      cleanWeights.corrupted ||
      cleanCharacter.corrupted ||
      cleanGoals.corrupted
    ) {
      return { valid: false, error: 'Некоторые разделы резервной копии повреждены.' };
    }

    return {
      valid: true,
      snapshot: {
        version: 1,
        exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
        journal: cleanJournal.entries,
        weights: cleanWeights.measurements,
        character: cleanCharacter.profile,
        goals: cleanGoals.goals,
      },
    };
  } catch {
    return { valid: false, error: 'Не удалось прочитать JSON. Проверь целостность файла.' };
  }
}
