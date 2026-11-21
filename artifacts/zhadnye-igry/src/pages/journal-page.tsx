import { type FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AlertTriangle, Check, Save, Scale } from 'lucide-react';
import type { GameStore } from '@/hooks/use-game-store';
import {
  EMPTY_ENTRY,
  isJournalEntryPopulated,
  validateJournalEntry,
  type JournalEntry,
} from '@/lib/journal-storage';
import { formatDateRu, todayIso } from '@/lib/date-utils';
import { EpistemicLabel, PageHeading } from '@/components/page-heading';

function DecimalField({
  label,
  name,
  value,
  onChange,
  placeholder,
  unit,
  testId,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
  testId: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold text-[#d2cec3]">
        <span>{label}</span>
        {hint ? <span className="text-[11px] font-normal text-[#8a8c92]">{hint}</span> : null}
      </span>
      <div className="relative">
        <input
          className="field pr-14 tabular"
          data-testid={testId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          placeholder={placeholder ?? 'Не указано'}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit ? (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-[#7c7f86]">
            {unit}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function ScaleSelector({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  testPrefix,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  lowLabel: string;
  highLabel: string;
  testPrefix: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
        <span className="font-semibold text-[#d2cec3]">{label}</span>
        <span className="text-[11px]">
          <EpistemicLabel status="self-assessment" />
        </span>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((num) => {
          const active = value === String(num);
          return (
            <button
              type="button"
              key={num}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active ? '' : String(num))}
              className={`grid h-11 w-11 place-items-center rounded-lg border text-sm font-semibold tabular transition ${
                active
                  ? 'border-[#c4ad72] bg-[#c4ad72]/15 text-[#ead69e]'
                  : 'border-[#383c45] bg-[#14181f] text-[#9b9c95] hover:border-[#796f56] hover:text-[#efe7d7]'
              }`}
              data-testid={`${testPrefix}-${num}`}
            >
              {num}
            </button>
          );
        })}
      </div>
      <span className="mt-1.5 block text-[11px] text-[#8a8c92]">
        1 — {lowLabel} · 5 — {highLabel} · повторное нажатие очищает выбор
      </span>
    </div>
  );
}

export function JournalPage({ store }: { store: GameStore }) {
  const { entries, saveEntry } = store;
  const [location, setLocation] = useLocation();
  const requestedDate = new URLSearchParams(window.location.search).get('date');

  const [entry, setEntry] = useState<JournalEntry>(() => {
    const initialDate = requestedDate || todayIso();
    const match = entries.find((item) => item.date === initialDate);
    return match ? { ...EMPTY_ENTRY, ...match } : { ...EMPTY_ENTRY, date: initialDate };
  });
  const [originalDate, setOriginalDate] = useState(() => {
    const initialDate = requestedDate || todayIso();
    return entries.find((item) => item.date === initialDate)?.date ?? '';
  });
  const [collisionDate, setCollisionDate] = useState('');
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const date = requestedDate || todayIso();
    const match = entries.find((item) => item.date === date);
    setEntry(match ? { ...EMPTY_ENTRY, ...match } : { ...EMPTY_ENTRY, date });
    setOriginalDate(match?.date ?? '');
    setCollisionDate('');
    setErrors([]);
  }, [requestedDate, location]);

  const existingForDate = entries.find((item) => item.date === entry.date);
  const editingExisting = Boolean(originalDate);
  const hasDateConflict = Boolean(
    editingExisting &&
      originalDate !== entry.date &&
      existingForDate &&
      existingForDate.date === entry.date,
  );

  const update = (field: keyof JournalEntry, value: string) => {
    setEntry((current) => ({ ...current, [field]: value }));
    setNotice('');
  };

  const handleDateChange = (nextDate: string) => {
    setNotice('');
    setErrors([]);
    const match = entries.find((item) => item.date === nextDate);

    if (editingExisting && nextDate !== originalDate && match) {
      // Do NOT silently lose user edits or silently overwrite the other date!
      setEntry((current) => ({ ...current, date: nextDate }));
      setCollisionDate(nextDate);
      return;
    }

    setCollisionDate('');
    if (!editingExisting && match) {
      setEntry({ ...EMPTY_ENTRY, ...match });
      setOriginalDate(match.date);
    } else if (editingExisting) {
      setEntry((current) => ({ ...current, date: nextDate }));
    } else {
      setEntry((current) => ({ ...current, date: nextDate }));
    }
  };

  const openCollidingEntry = () => {
    if (!collisionDate) return;
    const match = entries.find((item) => item.date === collisionDate);
    if (match) {
      setEntry({ ...EMPTY_ENTRY, ...match });
      setOriginalDate(match.date);
      setCollisionDate('');
      setErrors([]);
    }
  };

  const revertToOriginalDate = () => {
    if (!originalDate) return;
    setEntry((current) => ({ ...current, date: originalDate }));
    setCollisionDate('');
  };

  const submitEntry = (allowOverwriteConflict: boolean) => {
    const check = validateJournalEntry(entry);
    if (!check.valid) {
      setErrors(check.errors);
      setNotice('');
      return;
    }

    if (hasDateConflict && !allowOverwriteConflict) {
      setCollisionDate(entry.date);
      setErrors([
        `На дату ${entry.date} уже есть запись. Подтверди перезапись или верни прежнюю дату.`,
      ]);
      return;
    }

    saveEntry(check.normalized, originalDate);
    setErrors([]);
    setCollisionDate('');
    setOriginalDate(check.normalized.date);
    setNotice(editingExisting ? 'Изменения сохранены.' : 'Запись дня сохранена.');

    if (requestedDate) {
      setLocation('/history');
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitEntry(false);
  };

  return (
    <div className="enter">
      <PageHeading
        kicker="Дневник реальной жизни"
        title={editingExisting ? 'Редактировать день' : 'Записать реальный день'}
        description="Фиксируй только то, что действительно произошло. Пустое поле остаётся неизвестным и не превращается в ноль."
        action={
          <Link href="/weight" className="btn-secondary">
            <Scale size={15} />
            Отдельный вес
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="space-y-4" data-testid="form-journal-entry">
        {/* Section 01: Date & Recovery */}
        <section className="panel rounded-2xl p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
            <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
              01. День и восстановление
            </h2>
            <span className="text-[11px] text-[#8a8c92]">Направление: Восстановление</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-[#d2cec3]">
                <span>Дата</span>
                <span className="text-[11px] font-normal text-[#8fc1a3]">Факт</span>
              </span>
              <input
                className="field tabular"
                data-testid="input-date"
                type="date"
                value={entry.date}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </label>

            <DecimalField
              label="Длительность сна"
              name="sleepHours"
              value={entry.sleepHours}
              onChange={(v) => update('sleepHours', v)}
              placeholder="Например, 7,5"
              unit="ч"
              hint="Факт · 0–24"
              testId="input-sleep-hours"
            />
          </div>

          {collisionDate ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-[#d5b97a]/35 bg-[#3d331d]/45 p-4 text-[13px] text-[#efe0b8]"
              data-testid="alert-date-collision"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#e0c482]" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    За {formatDateRu(collisionDate)} уже существует запись
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-[#d7cca8]">
                    Чтобы не потерять данные случайно, выбери действие явно:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={revertToOriginalDate}
                      className="btn-secondary"
                    >
                      Вернуть {originalDate}
                    </button>
                    <button
                      type="button"
                      onClick={openCollidingEntry}
                      className="btn-secondary"
                    >
                      Открыть запись за {collisionDate}
                    </button>
                    <button
                      type="button"
                      onClick={() => submitEntry(true)}
                      className="btn-secondary btn-danger"
                    >
                      Перезаписать {collisionDate}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ScaleSelector
              label="Качество сна"
              value={entry.sleepQuality}
              onChange={(v) => update('sleepQuality', v)}
              lowLabel="тяжело"
              highLabel="отлично"
              testPrefix="button-sleep-quality"
            />
            <ScaleSelector
              label="Уровень энергии"
              value={entry.energyLevel ?? ''}
              onChange={(v) => update('energyLevel', v)}
              lowLabel="истощение"
              highLabel="много сил"
              testPrefix="button-energy-level"
            />
          </div>
        </section>

        {/* Section 02: Movement & Craft */}
        <section className="panel rounded-2xl p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
            <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
              02. Движение и дело
            </h2>
            <span className="text-[11px] text-[#8a8c92]">Тело · Дело и мастерство</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DecimalField
              label="Прогулка и ходьба"
              name="walkingMinutes"
              value={entry.walkingMinutes}
              onChange={(v) => update('walkingMinutes', v)}
              placeholder="Например, 45"
              unit="мин"
              hint="Факт"
              testId="input-walking-minutes"
            />
            <DecimalField
              label="Работа над проектом"
              name="projectMinutes"
              value={entry.projectMinutes}
              onChange={(v) => update('projectMinutes', v)}
              placeholder="Например, 90"
              unit="мин"
              hint="Факт"
              testId="input-project-minutes"
            />
            <label className="block sm:col-span-2">
              <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-[#d2cec3]">
                <span>Ключевые задачи, работа или заработок</span>
                <span className="text-[11px] font-normal text-[#8a8c92]">Факт · опционально</span>
              </span>
              <input
                className="field"
                value={entry.workFocus ?? ''}
                onChange={(e) => update('workFocus', e.target.value)}
                placeholder="Что сделано по задачам, проектам или финансам"
                data-testid="input-work-focus"
              />
            </label>
          </div>
        </section>

        {/* Section 03: Habits & Weight Link */}
        <section className="panel rounded-2xl p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
            <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
              03. Привычки и тело
            </h2>
            <span className="text-[11px] text-[#8a8c92]">Направление: Стойкость</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="font-semibold text-[#d2cec3]">Трезвость</span>
                <span className="text-[11px] text-[#8fc1a3]">Факт</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'yes', label: 'Да' },
                  { value: 'no', label: 'Нет' },
                  { value: '', label: 'Не отмечать' },
                ].map((option) => (
                  <button
                    type="button"
                    key={option.label}
                    onClick={() => update('sobriety', option.value)}
                    className={`btn-secondary min-h-11 px-4 text-[13px] ${
                      entry.sobriety === option.value
                        ? 'border-[#c4ad72]/70 bg-[#c4ad72]/14 text-[#ead69e]'
                        : ''
                    }`}
                    data-testid={`button-sobriety-${option.value || 'unset'}`}
                  >
                    {entry.sobriety === option.value ? <Check size={14} /> : null}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <DecimalField
              label="Количество сигарет"
              name="cigarettes"
              value={entry.cigarettes}
              onChange={(v) => update('cigarettes', v)}
              placeholder="0 или число"
              unit="шт"
              hint="Факт · 0 сохраняется"
              testId="input-cigarettes"
            />
          </div>

          <div className="mt-4 flex flex-col justify-between gap-2 rounded-xl border border-white/[0.07] bg-[#14181f]/75 px-4 py-3 text-[12px] sm:flex-row sm:items-center">
            <div className="text-[#9c9d96]">
              Вес теперь ведётся в отдельном разделе измерений (можно фиксировать несколько замеров со временем и контекстом).
              {entry.weightKg ? ` В этой записи сохранено прежнее значение: ${entry.weightKg} кг.` : ''}
            </div>
            <Link
              href="/weight"
              className="shrink-0 font-semibold text-[#c9b47a] hover:text-[#e2cd92]"
            >
              Перейти к весу →
            </Link>
          </div>
        </section>

        {/* Section 04: Notes */}
        <section className="panel rounded-2xl p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/[0.07] pb-3">
            <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
              04. Наблюдения дня
            </h2>
            <span className="text-[11px] text-[#8a8c92]">Направление: Хроника</span>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Заметки
            </span>
            <textarea
              className="field min-h-[112px]"
              data-testid="input-notes"
              value={entry.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="События, мысли, самочувствие или контекст этого дня"
            />
          </label>
        </section>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="rounded-xl border border-[#d66c61]/40 bg-[#5c2520]/35 px-4 py-3 text-[13px] text-[#f0b4ad]"
            data-testid="status-journal-error"
          >
            {errors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="rounded-xl border border-[#72a988]/40 bg-[#1e3d2d]/45 px-4 py-3 text-[13px] text-[#bde2cb]"
            data-testid="status-journal-saved"
          >
            {notice}
          </div>
        ) : null}

        <div className="flex flex-col-reverse justify-between gap-3 pt-1 sm:flex-row sm:items-center">
          <p className="m-0 text-[12px] leading-5 text-[#8a8c92]">
            Данные сохраняются локально на этом устройстве. Резервная копия доступна в разделе «История».
          </p>
          <button
            className="btn-primary"
            type="submit"
            data-testid="button-save-entry"
          >
            <Save size={16} />
            {editingExisting || existingForDate ? 'Сохранить изменения' : 'Сохранить день'}
          </button>
        </div>
      </form>
    </div>
  );
}
