import { type FormEvent, useMemo, useState } from 'react';
import { Check, Edit3, Pause, Play, Plus, Target, Trash2, X } from 'lucide-react';
import type { GameStore } from '@/hooks/use-game-store';
import {
  createEntityId,
  DEVELOPMENT_DOMAINS,
  getDomainById,
  type DomainId,
  type GoalItem,
  type GoalStatus,
} from '@/lib/rpg-storage';
import { formatShortDateRu, todayIso } from '@/lib/date-utils';
import { EpistemicLabel, PageHeading } from '@/components/page-heading';

type StatusFilter = 'active' | 'all' | 'completed';

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Активна',
  paused: 'На паузе',
  completed: 'Завершена',
};

export function GoalsPage({ store }: { store: GameStore }) {
  const { goals, domainSnapshots, saveGoal, removeGoal } = store;

  const [filter, setFilter] = useState<StatusFilter>('active');
  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState('');
  const [domainId, setDomainId] = useState<DomainId>('craft');
  const [nextStep, setNextStep] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GoalItem | null>(null);

  const snapshotByDomain = useMemo(() => {
    const map = new Map(domainSnapshots.map((s) => [s.domain.id, s]));
    return map;
  }, [domainSnapshots]);

  const filteredGoals = useMemo(() => {
    if (filter === 'active') return goals.filter((g) => g.status === 'active');
    if (filter === 'completed') return goals.filter((g) => g.status === 'completed');
    return goals;
  }, [goals, filter]);

  const resetForm = () => {
    setEditingId('');
    setTitle('');
    setDomainId('craft');
    setNextStep('');
    setError('');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Укажи название цели.');
      setNotice('');
      return;
    }

    const existing = editingId ? goals.find((g) => g.id === editingId) : undefined;
    const today = todayIso();
    const item: GoalItem = {
      id: existing?.id ?? createEntityId('goal'),
      title: title.trim(),
      domainId,
      nextStep: nextStep.trim(),
      status: existing?.status ?? 'active',
      createdAt: existing?.createdAt || today,
      updatedAt: today,
    };

    saveGoal(item);
    setNotice(existing ? 'Цель обновлена.' : 'Цель добавлена.');
    resetForm();
  };

  const startEdit = (goal: GoalItem) => {
    setEditingId(goal.id);
    setTitle(goal.title);
    setDomainId(goal.domainId);
    setNextStep(goal.nextStep);
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateStatus = (goal: GoalItem, nextStatus: GoalStatus) => {
    saveGoal({ ...goal, status: nextStatus, updatedAt: todayIso() });
    setNotice(
      nextStatus === 'completed'
        ? `Цель «${goal.title}» отмечена завершённой (без автоматического начисления XP).`
        : `Статус цели «${goal.title}» обновлён.`,
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeGoal(deleteTarget.id);
    if (editingId === deleteTarget.id) resetForm();
    setNotice(`Цель «${deleteTarget.title}» удалена.`);
    setDeleteTarget(null);
  };

  return (
    <div className="enter space-y-6">
      <PageHeading
        kicker="Цели и следующий шаг · Игровой слой"
        title="Цели и маршруты"
        description="Каждая цель привязана к направлению развития и показывает последнее реальное наблюдение. Завершение цели фиксируется как факт без вымышленных наград."
      />

      {/* Goal Editor Form */}
      <form
        onSubmit={onSubmit}
        className="panel rounded-2xl p-5 md:p-6"
        data-testid="form-goal"
      >
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
          <div>
            <h2 className="m-0 text-[15px] font-bold text-[#f0e8d8]">
              {editingId ? 'Редактировать цель' : 'Новая цель'}
            </h2>
            <div className="mt-0.5 text-[12px] text-[#8a8c92]">
              Статус данных: <EpistemicLabel status="self-assessment" /> · задано вручную
            </div>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm} className="btn-secondary">
              <X size={14} />
              Отмена
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Название цели
            </span>
            <input
              className="field"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
                setNotice('');
              }}
              placeholder="Например, Стабилизировать режим сна"
              data-testid="input-goal-title"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Направление развития
            </span>
            <select
              className="field"
              value={domainId}
              onChange={(e) => setDomainId(e.target.value as DomainId)}
              data-testid="select-goal-domain"
            >
              {DEVELOPMENT_DOMAINS.map((domain) => (
                <option key={domain.id} value={domain.id} className="bg-[#161a21]">
                  {domain.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
              Конкретный следующий шаг
            </span>
            <input
              className="field"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Ближайшее понятное действие, которое реально сделать в ближайшие дни"
              data-testid="input-goal-next-step"
            />
          </label>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#d66c61]/40 bg-[#5c2520]/35 px-4 py-3 text-[13px] text-[#f0b4ad]"
          >
            {error}
          </div>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-[#72a988]/40 bg-[#1e3d2d]/45 px-4 py-3 text-[13px] text-[#bde2cb]"
            data-testid="status-goal-saved"
          >
            {notice}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button type="submit" className="btn-primary" data-testid="button-save-goal">
            <Plus size={16} />
            {editingId ? 'Сохранить цель' : 'Добавить цель'}
          </button>
        </div>
      </form>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-xl border border-white/[0.08] bg-[#14181f] p-1"
          role="tablist"
          aria-label="Фильтр целей"
        >
          {(
            [
              { id: 'active', label: `Активные (${goals.filter((g) => g.status === 'active').length})` },
              { id: 'all', label: `Все (${goals.length})` },
              { id: 'completed', label: `Завершённые (${goals.filter((g) => g.status === 'completed').length})` },
            ] as { id: StatusFilter; label: string }[]
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
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goal Cards */}
      {filteredGoals.length === 0 ? (
        <section className="panel rounded-2xl p-8 text-center" data-testid="empty-goals">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-[#c4ad72]/20 bg-[#c4ad72]/10 text-[#c9b47a]">
            <Target size={20} />
          </div>
          <h2 className="page-title m-0 text-2xl text-[#f2eadb]">
            {filter === 'active'
              ? 'Активных целей пока нет'
              : filter === 'completed'
                ? 'Завершённых целей пока нет'
                : 'Список целей пуст'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-[#9c9d96]">
            Добавь одну конкретную цель и следующий шаг выше. Привязка к направлению сразу покажет связь с реальными записями.
          </p>
        </section>
      ) : (
        <div className="space-y-3" data-testid="list-goals">
          {filteredGoals.map((goal) => {
            const domain = getDomainById(goal.domainId);
            const snapshot = snapshotByDomain.get(goal.domainId);

            return (
              <article
                key={goal.id}
                className="panel rounded-2xl p-5"
                data-testid={`goal-card-${goal.id}`}
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#8f9196]">
                      <span className="font-semibold text-[#c9b47a]">{domain.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{STATUS_LABELS[goal.status]}</span>
                      <span aria-hidden="true">·</span>
                      <EpistemicLabel status="self-assessment" />
                    </div>

                    <h3 className="page-title mt-1.5 text-[24px] leading-snug text-[#f2eadb]">
                      {goal.title}
                    </h3>

                    <div className="mt-2 text-[14px] leading-6 text-[#d2cec3]">
                      <span className="text-[#8a8c92]">Следующий шаг: </span>
                      {goal.nextStep || 'Не указан'}
                    </div>

                    {/* Linked Real-Life Fact (Claim-to-Proof Adjacency) */}
                    <div className="mt-3.5 border-t border-white/[0.07] pt-3 text-[12px] text-[#9c9d96]">
                      <span className="text-[#8a8c92]">Реальная опора ({domain.shortLabel}): </span>
                      {snapshot?.latestConfirmed ? (
                        <>
                          <span className="font-semibold text-[#e6dfd1]">
                            {snapshot.latestConfirmed.label} — {snapshot.latestConfirmed.value}
                          </span>{' '}
                          <span className="text-[#8a8c92]">
                            ({formatShortDateRu(snapshot.latestConfirmed.date)} ·{' '}
                            <EpistemicLabel status="confirmed" />)
                          </span>
                        </>
                      ) : (
                        <span>
                          <EpistemicLabel status="unknown" /> · наблюдений в этом направлении ещё нет
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap shrink-0 gap-2 sm:flex-col">
                    {goal.status !== 'completed' ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(goal, 'completed')}
                        className="btn-secondary min-h-11 px-3 text-[12px]"
                      >
                        <Check size={14} />
                        Завершить
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateStatus(goal, 'active')}
                        className="btn-secondary min-h-11 px-3 text-[12px]"
                      >
                        <Play size={13} />
                        Вернуть в работу
                      </button>
                    )}

                    {goal.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(goal, 'paused')}
                        className="btn-secondary min-h-11 px-3 text-[12px]"
                      >
                        <Pause size={13} />
                        Пауза
                      </button>
                    ) : goal.status === 'paused' ? (
                      <button
                        type="button"
                        onClick={() => updateStatus(goal, 'active')}
                        className="btn-secondary min-h-11 px-3 text-[12px]"
                      >
                        <Play size={13} />
                        Продолжить
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => startEdit(goal)}
                      className="btn-secondary min-h-11 px-3 text-[12px]"
                    >
                      <Edit3 size={13} />
                      Изменить
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(goal)}
                      className="btn-secondary btn-danger min-h-11 px-3 text-[12px]"
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
      )}

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
            aria-labelledby="delete-goal-title"
            className="panel w-full max-w-md rounded-2xl p-6"
          >
            <h2 id="delete-goal-title" className="page-title m-0 text-2xl text-[#f2eadb]">
              Удалить цель?
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#9c9d96]">
              Цель «{deleteTarget.title}» будет удалена с этого устройства. Реальные записи дневника и веса сохранятся.
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
