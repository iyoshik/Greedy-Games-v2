import {
  normalizeDecimalInput,
  parseFiniteNumber,
  type JournalEntry,
  type JournalStorage,
} from './journal-storage.ts';

export type WeightContext = 'morning' | 'evening' | 'other' | '';

export type WeightMeasurement = {
  id: string;
  date: string;
  time: string;
  weightKg: string;
  context: WeightContext;
  note: string;
  source: 'manual' | 'journal-legacy';
};

export type WeightReadResult = {
  measurements: WeightMeasurement[];
  corrupted: boolean;
  rawValue: string | null;
};

export const WEIGHT_STORAGE_KEY = 'zhadnye-igry-weight-v1';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const EMPTY_WEIGHT: WeightMeasurement = {
  id: '',
  date: '',
  time: '',
  weightKg: '',
  context: '',
  note: '',
  source: 'manual',
};

export function createWeightId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `wt-${Date.now()}-${rand}`;
}

export function sortWeights(items: WeightMeasurement[]): WeightMeasurement[] {
  return [...items].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    const byTime = (b.time || '').localeCompare(a.time || '');
    if (byTime !== 0) return byTime;
    return b.id.localeCompare(a.id);
  });
}

export function normalizeWeight(item: WeightMeasurement): WeightMeasurement {
  return {
    id: item.id.trim() || createWeightId(),
    date: item.date.trim(),
    time: item.time.trim(),
    weightKg: normalizeDecimalInput(item.weightKg),
    context:
      item.context === 'morning' || item.context === 'evening' || item.context === 'other'
        ? item.context
        : '',
    note: item.note.trim(),
    source: item.source === 'journal-legacy' ? 'journal-legacy' : 'manual',
  };
}

export function validateWeightMeasurement(item: WeightMeasurement): {
  valid: boolean;
  errors: string[];
  normalized: WeightMeasurement;
} {
  const normalized = normalizeWeight(item);
  const errors: string[] = [];

  if (!DATE_RE.test(normalized.date)) {
    errors.push('Укажи корректную дату измерения.');
  }

  if (normalized.time !== '' && !TIME_RE.test(normalized.time)) {
    errors.push('Время измерения должно быть в формате ЧЧ:ММ.');
  }

  const kg = parseFiniteNumber(normalized.weightKg);
  if (kg === null) {
    errors.push('Укажи значение веса в килограммах.');
  } else if (kg < 20 || kg > 400) {
    errors.push('Вес должен быть числом от 20 до 400 кг.');
  }

  return { valid: errors.length === 0, errors, normalized };
}

export function readWeightsWithStatus(storage?: JournalStorage): WeightReadResult {
  let raw: string | null = null;
  try {
    raw = (storage ?? window.localStorage).getItem(WEIGHT_STORAGE_KEY);
  } catch {
    return { measurements: [], corrupted: true, rawValue: null };
  }

  if (!raw) {
    return { measurements: [], corrupted: false, rawValue: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return { measurements: [], corrupted: true, rawValue: raw };
    }

    const measurements = sortWeights(
      parsed
        .filter(
          (item): item is Record<string, unknown> =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            item.id.trim() !== '' &&
            typeof item.date === 'string' &&
            DATE_RE.test(item.date) &&
            item.weightKg != null &&
            String(item.weightKg).trim() !== '',
        )
        .map((item) =>
          normalizeWeight({
            id: String(item.id),
            date: String(item.date),
            time: typeof item.time === 'string' ? item.time : '',
            weightKg: String(item.weightKg),
            context:
              item.context === 'morning' || item.context === 'evening' || item.context === 'other'
                ? item.context
                : '',
            note: typeof item.note === 'string' ? item.note : '',
            source: item.source === 'journal-legacy' ? 'journal-legacy' : 'manual',
          }),
        ),
    );

    return { measurements, corrupted: false, rawValue: raw };
  } catch {
    return { measurements: [], corrupted: true, rawValue: raw };
  }
}

export function readWeights(storage?: JournalStorage): WeightMeasurement[] {
  return readWeightsWithStatus(storage).measurements;
}

export function persistWeights(items: WeightMeasurement[], storage?: JournalStorage): boolean {
  try {
    (storage ?? window.localStorage).setItem(WEIGHT_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function upsertWeight(
  items: WeightMeasurement[],
  item: WeightMeasurement,
): WeightMeasurement[] {
  const normalized = normalizeWeight(item);
  return sortWeights([...items.filter((existing) => existing.id !== normalized.id), normalized]);
}

export function deleteWeight(items: WeightMeasurement[], id: string): WeightMeasurement[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Non-destructively combines independent WeightMeasurement records with any legacy
 * weightKg stored inside JournalEntry so old data is never lost or hidden.
 */
export function getCombinedWeightHistory(
  weights: WeightMeasurement[],
  journalEntries: JournalEntry[],
): WeightMeasurement[] {
  const manualDates = new Set(weights.map((item) => item.date));
  const legacyItems: WeightMeasurement[] = [];

  for (const entry of journalEntries) {
    const val = normalizeDecimalInput(entry.weightKg);
    if (val === '' || parseFiniteNumber(val) === null) continue;
    if (manualDates.has(entry.date)) continue;

    legacyItems.push({
      id: `legacy-journal-${entry.date}`,
      date: entry.date,
      time: '',
      weightKg: val,
      context: '',
      note: 'Из записи дневника',
      source: 'journal-legacy',
    });
  }

  return sortWeights([...weights, ...legacyItems]);
}
