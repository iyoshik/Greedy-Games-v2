import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  CalendarDays,
  Download,
  Edit3,
  Plus,
  Scale,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { GameStore } from '@/hooks/use-game-store';
import type { JournalEntry } from '@/lib/journal-storage';
import type { WeightMeasurement } from '@/lib/weight-storage';
import {
  formatDateRu,
  formatMonthGroupRu,
  pluralizeRu,
  todayIso,
} from '@/lib/date-utils';
import { EpistemicLabel, PageHeading } from '@/components/page-heading';

type HistoryFilter = 'all' | 'journal' | 'weight';

type TimelineItem =
  | { kind: 'journal'; sortKey: string; date: string; entry: JournalEntry }
  | { kind: 'weight'; sortKey: string; date: string; measurement: WeightMeasurement };

function metricValue(value: string, unit: string) {
  return value === '' ? '—' : `${value}${unit}`;
}

export function HistoryPage({ store }: { store: GameStore }) {
  const {
    entries,
    combinedWeights,
    removeEntry,
    removeWeight,
    exportBackupJson,
    importBackupJson,
  } = store;
  const [, setLocation] = useLocation();

  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'journal'; date: string }
    | { kind: 'weight'; item: WeightMeasurement }
    | null
  >(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    if (filter === 'all' || filter === 'journal') {
      for (const entry of entries) {
        items.push({
          kind: 'journal',
          sortKey: `${entry.date}-2`,
          date: entry.date,
          entry,
        });
      }
    }
    if (filter === 'all' || filter === 'weight') {
      for (const measurement of combinedWeights) {
        items.push({
          kind: 'weight',
          sortKey: `${measurement.date}-1-${measurement.time || '00:00'}`,
          date: measurement.date,
          measurement,
        });
      }
    }
    return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [entries, combinedWeights, filter]);

  const monthGroups = useMemo(() => {
    const groups: { month: string; items: TimelineItem[] }[] = [];
    for (const item of timeline) {
      const month = formatMonthGroupRu(item.date);
      const last = groups[groups.length - 1];
      if (last?.month === month) last.items.push(item);
      else groups.push({ month, items: [item] });
    }
    return groups;
  }, [timeline]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'journal') {
      removeEntry(deleteTarget.date);
      setStatusMessage(`Запись дневника за ${deleteTarget.date} удалена.`);
    } else {
      removeWeight(deleteTarget.item.id);
      setStatusMessage(`Измерение веса за ${deleteTarget.item.date} удалено.`);
    }
    setDeleteTarget(null);
  };

  const handleExport = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zhadnye-igry-backup-${todayIso()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBackupError('');
    setStatusMessage('Резервная копия JSON сохранена на устройство.');
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const result = importBackupJson(text);
      if (result.ok) {
        setBackupError('');
        setStatusMessage(result.message);
      } else {
        setBackupError(result.message);
        setStatusMessage('');
      }
    } catch {
      setBackupError('Не удалось прочитать выбранный файл.');
    }
  };

  return (
    <div className="enter space-y-6">
      <PageHeading
        kicker="Архив наблюдений"
        title="История"
        description="Все сохранённые дни и отдельные измерения веса в обратном хронологическом порядке."
        action={
          <>
            <Link href="/journal" className="btn-primary" data-testid="button-history-add">
              <Plus size={15} />
              Записать день
            </Link>
            <Link href="/weight" className="btn-secondary">
              <Scale size={15} />
              Вес
            </Link>
          </>
        }
      />

      {statusMessage ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-[#72a988]/35 bg-[#1e3d2d]/40 px-4 py-3 text-[13px] text-[#bde2cb]"
          role="status"
          data-testid="status-record-deleted"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-[#d6e6d9] hover:bg-white/10"
            onClick={() => setStatusMessage('')}
            aria-label="Скрыть уведомление"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-xl border border-white/[0.08] bg-[#14181f] p-1"
          role="tablist"
          aria-label="Фильтр истории"
        >
          {(
            [
              { id: 'all', label: `Всё (${entries.length + combinedWeights.length})` },
              { id: 'journal', label: `Дневник (${entries.length})` },
              { id: 'weight', label: `Вес (${combinedWeights.length})` },
            ] as { id: HistoryFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              onClick={() => setFilter(tab.id)}
              className={`min-h-10 rounded-lg px-3.5 text-[12px] font-semibold whitespace-nowrap transition ${
                filter === tab.id
                  ? 'bg-[#c4ad72]/18 text-[#ead69e]'
                  : 'text-[#9a9b94] hover:text-[#efe7d7]'
              }`}
              data-testid={`filter-history-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      {timeline.length === 0 ? (
        <section
          className="panel rounded-2xl px-6 py-10 text-center"
          data-testid="empty-history"
        >
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#c4ad72]/25 bg-[#c4ad72]/10 text-[#cbb579]">
            <CalendarDays size={21} />
          </div>
          <h2 className="page-title m-0 text-2xl text-[#f2eadb]">
            В этой ленте пока нет записей
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[#9c9d96]">
            Добавь запись дня или измерение веса — здесь соберётся твоя подтверждённая хроника.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/journal" className="btn-primary">
              <Plus size={15} />
              Записать день
            </Link>
            <Link href="/weight" className="btn-secondary">
              <Scale size={15} />
              Зафиксировать вес
            </Link>
          </div>
        </section>
      ) : (
        <div className="space-y-8" data-testid="list-history">
          {monthGroups.map((group) => (
            <section key={group.month}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="m-0 text-[12px] font-bold capitalize tracking-[0.06em] text-[#b8a572]">
                  {group.month}
                </h2>
                <span className="mono text-[11px] text-[#7c7f86]">
                  {group.items.length}{' '}
                  {pluralizeRu(group.items.length, 'запись', 'записи', 'записей')}
                </span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>

              <div className="space-y-3">
                {group.items.map((item) => {
                  if (item.kind === 'weight') {
                    const m = item.measurement;
                    const isLegacy = m.source === 'journal-legacy';
                    return (
                      <article
                        key={`weight-${m.id}`}
                        className="panel flex flex-col justify-between gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
                        data-testid={`history-weight-${m.id}`}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#8f9196]">
                            <span className="font-semibold text-[#c9b47a]">Измерение веса</span>
                            <span aria-hidden="true">·</span>
                            <EpistemicLabel status="confirmed" />
                            <span aria-hidden="true">·</span>
                            <span className="mono">{m.date}{m.time ? ` ${m.time}` : ''}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                            <span className="metric-value text-[24px] text-[#f2eadb]">
                              {m.weightKg} кг
                            </span>
                            <span className="text-[13px] capitalize text-[#c5c2b8]">
                              {formatDateRu(m.date)}
                            </span>
                          </div>
                          {m.note ? (
                            <p className="mb-0 mt-1 text-[12px] text-[#9c9d96]">{m.note}</p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => setLocation(`/weight?edit=${encodeURIComponent(m.id)}`)}
                            className="btn-secondary min-h-11 px-3 text-[12px]"
                          >
                            <Edit3 size={13} />
                            {isLegacy ? 'Вынести' : 'Изменить'}
                          </button>
                          {!isLegacy ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: 'weight', item: m })}
                              className="btn-secondary btn-danger min-h-11 px-3 text-[12px]"
                            >
                              <Trash2 size={13} />
                              Удалить
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  }

                  const entry = item.entry;
                  const details = [
                    ['Сон', metricValue(entry.sleepHours, ' ч')],
                    ['Прогулка', metricValue(entry.walkingMinutes, ' мин')],
                    ['Проект', metricValue(entry.projectMinutes, ' мин')],
                    ['Сигареты', entry.cigarettes === '' ? '—' : entry.cigarettes],
                    [
                      'Трезвость',
                      entry.sobriety === 'yes'
                        ? 'Да'
                        : entry.sobriety === 'no'
                          ? 'Нет'
                          : '—',
                    ],
                  ];

                  return (
                    <article
                      key={`journal-${entry.date}`}
                      className="panel rounded-xl p-4 md:p-5"
                      data-testid={`record-card-${entry.date}`}
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#8f9196]">
                            <span className="font-semibold text-[#d2cec3]">Дневник дня</span>
                            <span aria-hidden="true">·</span>
                            <EpistemicLabel status="confirmed" />
                            <span aria-hidden="true">·</span>
                            <span className="mono">{entry.date}</span>
                          </div>
                          <h3
                            className="page-title m-0 mt-1 text-[22px] capitalize text-[#f2eadb]"
                            data-testid={`record-date-${entry.date}`}
                          >
                            {formatDateRu(entry.date)}
                          </h3>

                          <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
                            {details.map(([label, value]) => (
                              <div key={label}>
                                <div className="text-[11px] text-[#8a8c92]">{label}</div>
                                <div className="mt-0.5 text-[13px] font-semibold tabular text-[#ded8cb]">
                                  {value}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#9c9d96]">
                            <span>
                              Самооценка — качество сна:{' '}
                              {entry.sleepQuality ? `${entry.sleepQuality}/5` : '—'}
                            </span>
                            {entry.energyLevel ? (
                              <span>энергия: {entry.energyLevel}/5</span>
                            ) : null}
                            {entry.weightKg ? (
                              <span>вес (в записи): {entry.weightKg} кг</span>
                            ) : null}
                          </div>

                          {entry.workFocus ? (
                            <p className="mb-0 mt-2.5 text-[12px] text-[#c5c2b8]">
                              <span className="text-[#8a8c92]">Фокус дня: </span>
                              {entry.workFocus}
                            </p>
                          ) : null}

                          {entry.notes ? (
                            <p className="mb-0 mt-3 line-clamp-3 whitespace-pre-wrap border-t border-white/[0.06] pt-3 text-[13px] leading-5 text-[#b5b2a8]">
                              {entry.notes}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 gap-2 sm:flex-col">
                          <button
                            type="button"
                            onClick={() => setLocation(`/journal?date=${entry.date}`)}
                            className="btn-secondary min-h-11 px-3 text-[12px]"
                            data-testid={`button-edit-${entry.date}`}
                          >
                            <Edit3 size={13} />
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: 'journal', date: entry.date })}
                            className="btn-secondary btn-danger min-h-11 px-3 text-[12px]"
                            data-testid={`button-delete-${entry.date}`}
                          >
                            <Trash2 size={13} />
                            Удалить
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Local Backup & Restore Panel */}
      <section className="panel rounded-2xl p-5 md:p-6" data-testid="section-backup">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="page-title m-0 text-2xl text-[#f2eadb]">
              Резервная копия данных
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-6 text-[#9c9d96]">
              Все данные хранятся локально в этом браузере. Периодически сохраняй JSON-файл, чтобы защитить историю при смене телефона или очистке Safari.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="btn-secondary"
              data-testid="button-export-backup"
            >
              <Download size={15} />
              Скачать JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              data-testid="button-import-backup"
            >
              <Upload size={15} />
              Загрузить JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {backupError ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#d66c61]/40 bg-[#5c2520]/35 px-4 py-3 text-[13px] text-[#f0b4ad]"
          >
            {backupError}
          </div>
        ) : null}
      </section>

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-history-title"
            className="panel w-full max-w-md rounded-2xl p-6"
            data-testid="dialog-confirm-delete"
          >
            <h2 id="delete-history-title" className="page-title m-0 text-2xl text-[#f2eadb]">
              {deleteTarget.kind === 'journal'
                ? 'Удалить запись дневника?'
                : 'Удалить измерение веса?'}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#9c9d96]">
              {deleteTarget.kind === 'journal'
                ? `Запись за ${formatDateRu(deleteTarget.date)} будет удалена с этого устройства.`
                : `Замер ${deleteTarget.item.weightKg} кг за ${formatDateRu(deleteTarget.item.date)} будет удалён с этого устройства.`}{' '}
              Это действие нельзя отменить.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
                data-testid="button-cancel-delete"
              >
                Оставить
              </button>
              <button
                type="button"
                className="btn-secondary btn-danger"
                onClick={confirmDelete}
                data-testid="button-confirm-delete"
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
