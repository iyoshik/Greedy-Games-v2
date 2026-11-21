import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Check, Edit3, Plus, Scale, Trash2, X } from 'lucide-react';
import type { GameStore } from '@/hooks/use-game-store';
import {
  createWeightId,
  EMPTY_WEIGHT,
  validateWeightMeasurement,
  type WeightContext,
  type WeightMeasurement,
} from '@/lib/weight-storage';
import { parseFiniteNumber } from '@/lib/journal-storage';
import { formatNumericDelta } from '@/lib/rpg-storage';
import { formatDateRu, formatShortDateRu, nowTimeHHMM, todayIso } from '@/lib/date-utils';
import { EpistemicLabel, PageHeading } from '@/components/page-heading';

const CONTEXT_LABELS: Record<WeightContext, string> = {
  morning: 'Утром',
  evening: 'Вечером',
  other: 'В течение дня',
  '': 'Не отмечать',
};

function WeightTrendChart({ measurements }: { measurements: WeightMeasurement[] }) {
  const points = useMemo(() => {
    const valid = measurements
      .map((m) => ({ item: m, val: parseFiniteNumber(m.weightKg) }))
      .filter((x): x is { item: WeightMeasurement; val: number } => x.val !== null)
      .slice(0, 14)
      .reverse();
    return valid;
  }, [measurements]);

  if (points.length < 2) return null;

  const values = points.map((p) => p.val);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.4, (max - min) * 0.22);
  const yMin = min - pad;
  const yMax = max + pad;
  const width = 560;
  const height = 148;
  const left = 18;
  const right = 18;
  const top = 16;
  const bottom = 24;

  const coords = points.map((pt, idx) => {
    const x =
      left + (idx / Math.max(1, points.length - 1)) * (width - left - right);
    const y =
      top + ((yMax - pt.val) / Math.max(0.01, yMax - yMin)) * (height - top - bottom);
    return { ...pt, x, y };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');

  return (
    <section className="panel rounded-2xl p-5 md:p-6" data-testid="chart-weight-trend">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
            Динамика последних замеров
          </h2>
          <div className="mt-0.5 text-[12px] text-[#8a8c92]">
            Только фактические точки · без расчётных целей
          </div>
        </div>
        <div className="mono flex gap-4 text-[12px] text-[#c5c2b8]">
          <span>Мин: {min.toFixed(1)} кг</span>
          <span>Макс: {max.toFixed(1)} кг</span>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[150px] w-full"
          role="img"
          aria-label="График фактических измерений веса"
        >
          <line
            x1={left}
            y1={top}
            x2={width - right}
            y2={top}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 4"
          />
          <line
            x1={left}
            y1={height - bottom}
            x2={width - right}
            y2={height - bottom}
            stroke="rgba(255,255,255,0.08)"
          />
          <polyline
            fill="none"
            stroke="#c4ad72"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline}
          />
          {coords.map((pt, idx) => (
            <g key={pt.item.id}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={idx === coords.length - 1 ? 4.5 : 3.2}
                fill={idx === coords.length - 1 ? '#ead69e' : '#181c23'}
                stroke="#c4ad72"
                strokeWidth="2"
              />
            </g>
          ))}
        </svg>
        <div className="mono flex justify-between text-[11px] text-[#8a8c92]">
          <span>{formatShortDateRu(points[0].item.date)}</span>
          <span>{formatShortDateRu(points[points.length - 1].item.date)}</span>
        </div>
      </div>
    </section>
  );
}

export function WeightPage({ store }: { store: GameStore }) {
  const { combinedWeights, saveWeight, removeWeight } = store;
  const [location] = useLocation();
  const editQueryId = new URLSearchParams(window.location.search).get('edit');

  const [draft, setDraft] = useState<WeightMeasurement>({
    ...EMPTY_WEIGHT,
    date: todayIso(),
    time: nowTimeHHMM(),
  });
  const [editingId, setEditingId] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WeightMeasurement | null>(null);

  useEffect(() => {
    if (!editQueryId) return;
    const match = combinedWeights.find((item) => item.id === editQueryId);
    if (match) {
      setDraft({ ...match, source: 'manual' });
      setEditingId(match.source === 'manual' ? match.id : '');
      setErrors([]);
      setNotice('');
    }
  }, [editQueryId, location]);

  const latest = combinedWeights[0];
  const previous = combinedWeights[1];
  const latestDelta = latest
    ? formatNumericDelta(latest.weightKg, previous?.weightKg, ' кг')
    : null;

  const resetForm = () => {
    setDraft({
      ...EMPTY_WEIGHT,
      date: todayIso(),
      time: nowTimeHHMM(),
    });
    setEditingId('');
    setErrors([]);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const candidate: WeightMeasurement = {
      ...draft,
      id: editingId || createWeightId(),
      source: 'manual',
    };
    const check = validateWeightMeasurement(candidate);
    if (!check.valid) {
      setErrors(check.errors);
      setNotice('');
      return;
    }

    saveWeight(check.normalized);
    setNotice(editingId ? 'Измерение обновлено.' : 'Измерение веса сохранено.');
    resetForm();
  };

  const startEdit = (item: WeightMeasurement) => {
    setDraft({
      ...item,
      source: 'manual',
    });
    setEditingId(item.source === 'manual' ? item.id : '');
    setErrors([]);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeWeight(deleteTarget.id);
    setNotice(`Измерение за ${deleteTarget.date} удалено.`);
    if (editingId === deleteTarget.id) {
      resetForm();
    }
    setDeleteTarget(null);
  };

  return (
    <div className="enter space-y-6">
      <PageHeading
        kicker="Отдельные измерения веса · Направление: Тело"
        title="Вес тела"
        description="Независимая фиксация взвешиваний с датой, временем и контекстом. Поддерживается несколько замеров в один день."
      />

      {/* Latest Fact Strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="panel rounded-2xl p-5">
          <div className="flex items-center justify-between text-[12px] text-[#9a9b94]">
            <span>Последний замер</span>
            <Scale size={15} className="text-[#c4ad72]" />
          </div>
          <div
            className="metric-value mt-2 text-[32px] text-[#f2eadb]"
            data-testid="weight-latest-value"
          >
            {latest ? `${latest.weightKg} кг` : '—'}
          </div>
          <div className="mt-1 text-[12px] text-[#8a8c92]">
            {latest ? (
              <>
                <EpistemicLabel status="confirmed" /> · {formatShortDateRu(latest.date)}
                {latest.time ? ` · ${latest.time}` : ''}
              </>
            ) : (
              <EpistemicLabel status="unknown" />
            )}
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <div className="text-[12px] text-[#9a9b94]">Изменение к прошлому</div>
          <div className="metric-value mt-2 text-[26px] text-[#e8dfc9]">
            {latestDelta ?? '—'}
          </div>
          <div className="mt-1 text-[12px] text-[#8a8c92]">
            {previous ? `Прошлый: ${previous.weightKg} кг (${formatShortDateRu(previous.date)})` : 'Нужно минимум 2 замера'}
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <div className="text-[12px] text-[#9a9b94]">Всего замеров</div>
          <div className="metric-value mt-2 text-[32px] text-[#f2eadb]">
            {combinedWeights.length}
          </div>
          <div className="mt-1 text-[12px] text-[#8a8c92]">
            Хранятся отдельно от дневника
          </div>
        </article>
      </section>

      {/* Weight Entry Form */}
      <form
        onSubmit={onSubmit}
        className="panel rounded-2xl p-5 md:p-6"
        data-testid="form-weight-measurement"
      >
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
          <div>
            <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
              {editingId ? 'Редактировать измерение' : 'Новое измерение веса'}
            </h2>
            <div className="mt-0.5 text-[12px] text-[#8a8c92]">
              Статус данных: <EpistemicLabel status="confirmed" />
            </div>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm} className="btn-secondary">
              <X size={14} />
              Отменить
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Вес (кг)
            </span>
            <div className="relative">
              <input
                className="field pr-12 tabular"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.weightKg}
                onChange={(e) => {
                  setDraft((c) => ({ ...c, weightKg: e.target.value }));
                  setNotice('');
                }}
                placeholder="Например, 84,2"
                data-testid="input-separate-weight-kg"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-[#7c7f86]">
                кг
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Дата
            </span>
            <input
              className="field tabular"
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((c) => ({ ...c, date: e.target.value }))}
              data-testid="input-weight-date"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Время (опционально)
            </span>
            <input
              className="field tabular"
              type="time"
              value={draft.time}
              onChange={(e) => setDraft((c) => ({ ...c, time: e.target.value }))}
              data-testid="input-weight-time"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Контекст взвешивания
            </span>
            <div className="flex flex-wrap gap-2">
              {(['morning', 'evening', 'other', ''] as WeightContext[]).map((ctx) => (
                <button
                  type="button"
                  key={ctx || 'none'}
                  onClick={() => setDraft((c) => ({ ...c, context: ctx }))}
                  className={`btn-secondary min-h-11 px-3.5 text-[12px] ${
                    draft.context === ctx
                      ? 'border-[#c4ad72]/70 bg-[#c4ad72]/14 text-[#ead69e]'
                      : ''
                  }`}
                >
                  {draft.context === ctx ? <Check size={13} /> : null}
                  {CONTEXT_LABELS[ctx]}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Заметка (опционально)
            </span>
            <input
              className="field"
              value={draft.note}
              onChange={(e) => setDraft((c) => ({ ...c, note: e.target.value }))}
              placeholder="Например, натощак, после дороги"
              data-testid="input-weight-note"
            />
          </label>
        </div>

        {errors.length > 0 ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#d66c61]/40 bg-[#5c2520]/35 px-4 py-3 text-[13px] text-[#f0b4ad]"
            data-testid="status-weight-error"
          >
            {errors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-[#72a988]/40 bg-[#1e3d2d]/45 px-4 py-3 text-[13px] text-[#bde2cb]"
            data-testid="status-weight-saved"
          >
            {notice}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            className="btn-primary"
            data-testid="button-save-weight"
          >
            <Plus size={16} />
            {editingId ? 'Сохранить изменения' : 'Добавить замер'}
          </button>
        </div>
      </form>

      {/* Trend Chart */}
      <WeightTrendChart measurements={combinedWeights} />

      {/* Measurements List */}
      <section className="space-y-3" aria-label="Журнал измерений веса">
        <div className="flex items-center justify-between">
          <h2 className="page-title m-0 text-2xl text-[#f2eadb]">
            История измерений
          </h2>
          <span className="mono text-[12px] text-[#8a8c92]">
            {combinedWeights.length}
          </span>
        </div>

        {combinedWeights.length === 0 ? (
          <div
            className="panel rounded-2xl p-8 text-center"
            data-testid="empty-weight-list"
          >
            <p className="m-0 text-[14px] text-[#9c9d96]">
              Измерений веса пока нет. Добавь первый замер выше — он сразу свяжется с направлением «Тело и движение».
            </p>
          </div>
        ) : (
          <div className="space-y-2.5" data-testid="list-weights">
            {combinedWeights.map((item, idx) => {
              const prevItem = combinedWeights[idx + 1];
              const delta = formatNumericDelta(item.weightKg, prevItem?.weightKg, ' кг');
              const isLegacy = item.source === 'journal-legacy';

              return (
                <article
                  key={item.id}
                  className="panel flex flex-col justify-between gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
                  data-testid={`weight-row-${item.id}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="metric-value text-[24px] text-[#f2eadb]">
                        {item.weightKg} кг
                      </span>
                      <span className="text-[13px] capitalize text-[#d0c9ba]">
                        {formatDateRu(item.date)}
                      </span>
                      {item.time ? (
                        <span className="mono text-[12px] text-[#8a8c92]">
                          {item.time}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#8f9196]">
                      <EpistemicLabel status="confirmed" />
                      {item.context ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{CONTEXT_LABELS[item.context]}</span>
                        </>
                      ) : null}
                      {delta ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#c4ad72]">{delta}</span>
                        </>
                      ) : null}
                      {isLegacy ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>из прежней записи дневника</span>
                        </>
                      ) : null}
                    </div>
                    {item.note && !isLegacy ? (
                      <p className="mb-0 mt-1.5 text-[12px] text-[#a6a7a0]">{item.note}</p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="btn-secondary min-h-11 px-3 text-[12px]"
                    >
                      <Edit3 size={13} />
                      {isLegacy ? 'Вынести отдельно' : 'Изменить'}
                    </button>
                    {!isLegacy ? (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="btn-secondary btn-danger min-h-11 px-3 text-[12px]"
                      >
                        <Trash2 size={13} />
                        Удалить
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-weight-title"
            className="panel w-full max-w-md rounded-2xl p-6"
          >
            <h2 id="delete-weight-title" className="page-title m-0 text-2xl text-[#f2eadb]">
              Удалить измерение веса?
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#9c9d96]">
              Замер {deleteTarget.weightKg} кг за {formatDateRu(deleteTarget.date)} будет удалён с этого устройства.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary"
              >
                Оставить
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="btn-secondary btn-danger"
                data-testid="button-confirm-delete-weight"
              >
                <Trash2 size={14} />
                Удалить
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
