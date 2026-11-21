export type SobrietyStatus = 'yes' | 'no' | '';

export type JournalEntry = {
  date: string;
  sleepHours: string;
  sleepQuality: string;
  walkingMinutes: string;
  projectMinutes: string;
  weightKg: string;
  cigarettes: string;
  sobriety: SobrietyStatus;
  notes: string;
  energyLevel?: string;
  workFocus?: string;
};

export type JournalStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type JournalReadResult = {
  entries: JournalEntry[];
  corrupted: boolean;
  rawValue: string | null;
};

export const STORAGE_KEY = 'zhadnye-igry-journal-v1';

export const EMPTY_ENTRY: JournalEntry = {
  date: '',
  sleepHours: '',
  sleepQuality: '',
  walkingMinutes: '',
  projectMinutes: '',
  weightKg: '',
  cigarettes: '',
  sobriety: '',
  notes: '',
  energyLevel: '',
  workFocus: '',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDecimalInput(raw: string): string {
  return raw.trim().replace(/,/g, '.');
}

export function parseFiniteNumber(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw);
  if (normalized === '') return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function sortByDate(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}

function sanitizeOptionalString(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

export function isJournalEntryPopulated(entry: JournalEntry): boolean {
  return Boolean(
    entry.notes.trim() ||
      (entry.workFocus ?? '').trim() ||
      entry.sleepHours.trim() !== '' ||
      entry.sleepQuality.trim() !== '' ||
      (entry.energyLevel ?? '').trim() !== '' ||
      entry.walkingMinutes.trim() !== '' ||
      entry.projectMinutes.trim() !== '' ||
      entry.weightKg.trim() !== '' ||
      entry.cigarettes.trim() !== '' ||
      entry.sobriety !== '',
  );
}

export function normalizeJournalEntry(entry: JournalEntry): JournalEntry {
  return {
    date: entry.date.trim(),
    sleepHours: normalizeDecimalInput(entry.sleepHours),
    sleepQuality: entry.sleepQuality.trim(),
    walkingMinutes: normalizeDecimalInput(entry.walkingMinutes),
    projectMinutes: normalizeDecimalInput(entry.projectMinutes),
    weightKg: normalizeDecimalInput(entry.weightKg),
    cigarettes: normalizeDecimalInput(entry.cigarettes),
    sobriety: entry.sobriety === 'yes' || entry.sobriety === 'no' ? entry.sobriety : '',
    notes: entry.notes,
    energyLevel: (entry.energyLevel ?? '').trim(),
    workFocus: (entry.workFocus ?? '').trim(),
  };
}

export function validateJournalEntry(entry: JournalEntry): {
  valid: boolean;
  errors: string[];
  normalized: JournalEntry;
} {
  const normalized = normalizeJournalEntry(entry);
  const errors: string[] = [];

  if (!DATE_RE.test(normalized.date)) {
    errors.push('Выбери корректную дату записи.');
  }

  if (!isJournalEntryPopulated(normalized)) {
    errors.push('Добавь хотя бы одно наблюдение. Пустые даты не сохраняются.');
  }

  if (normalized.sleepHours !== '') {
    const n = parseFiniteNumber(normalized.sleepHours);
    if (n === null || n < 0 || n > 24) {
      errors.push('Длительность сна должна быть числом от 0 до 24 часов.');
    }
  }

  if (normalized.sleepQuality !== '' && !['1', '2', '3', '4', '5'].includes(normalized.sleepQuality)) {
    errors.push('Качество сна должно быть от 1 до 5.');
  }

  if (
    normalized.energyLevel &&
    !['1', '2', '3', '4', '5'].includes(normalized.energyLevel)
  ) {
    errors.push('Уровень энергии должен быть от 1 до 5.');
  }

  if (normalized.walkingMinutes !== '') {
    const n = parseFiniteNumber(normalized.walkingMinutes);
    if (n === null || n < 0 || n > 1440) {
      errors.push('Прогулка должна быть числом от 0 до 1440 минут.');
    }
  }

  if (normalized.projectMinutes !== '') {
    const n = parseFiniteNumber(normalized.projectMinutes);
    if (n === null || n < 0 || n > 1440) {
      errors.push('Работа над проектом должна быть числом от 0 до 1440 минут.');
    }
  }

  if (normalized.weightKg !== '') {
    const n = parseFiniteNumber(normalized.weightKg);
    if (n === null || n < 20 || n > 400) {
      errors.push('Вес должен быть числом от 20 до 400 кг.');
    }
  }

  if (normalized.cigarettes !== '') {
    const n = parseFiniteNumber(normalized.cigarettes);
    if (n === null || n < 0 || n > 200 || !Number.isInteger(n)) {
      errors.push('Количество сигарет должно быть целым числом от 0 до 200.');
    }
  }

  return { valid: errors.length === 0, errors, normalized };
}

export function readEntriesWithStatus(storage?: JournalStorage): JournalReadResult {
  let raw: string | null = null;
  try {
    raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
  } catch {
    return { entries: [], corrupted: true, rawValue: null };
  }

  if (!raw) {
    return { entries: [], corrupted: false, rawValue: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { entries: [], corrupted: true, rawValue: raw };
    }

    const entries = sortByDate(
      parsed
        .filter(
          (item): item is Record<string, unknown> =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.date === 'string' &&
            DATE_RE.test(item.date),
        )
        .map((item) => ({
          ...EMPTY_ENTRY,
          date: item.date as string,
          sleepHours: sanitizeOptionalString(item.sleepHours),
          sleepQuality: sanitizeOptionalString(item.sleepQuality),
          walkingMinutes: sanitizeOptionalString(item.walkingMinutes),
          projectMinutes: sanitizeOptionalString(item.projectMinutes),
          weightKg: sanitizeOptionalString(item.weightKg),
          cigarettes: sanitizeOptionalString(item.cigarettes),
          sobriety: item.sobriety === 'yes' || item.sobriety === 'no' ? item.sobriety : '',
          notes: typeof item.notes === 'string' ? item.notes : '',
          energyLevel: sanitizeOptionalString(item.energyLevel),
          workFocus: typeof item.workFocus === 'string' ? item.workFocus : '',
        })),
    );

    return { entries, corrupted: false, rawValue: raw };
  } catch {
    return { entries: [], corrupted: true, rawValue: raw };
  }
}

export function readEntries(storage?: JournalStorage): JournalEntry[] {
  return readEntriesWithStatus(storage).entries;
}

export function persistEntries(entries: JournalEntry[], storage?: JournalStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function upsertEntry(
  entries: JournalEntry[],
  entry: JournalEntry,
  previousDate = '',
): JournalEntry[] {
  const normalized = normalizeJournalEntry(entry);
  return sortByDate([
    ...entries.filter((item) => item.date !== previousDate && item.date !== normalized.date),
    normalized,
  ]);
}

export function deleteEntry(entries: JournalEntry[], date: string): JournalEntry[] {
  return entries.filter((item) => item.date !== date);
}
