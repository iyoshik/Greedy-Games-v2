import { type FormEvent, useState } from 'react';
import { Link } from 'wouter';
import {
  Activity,
  ArrowRight,
  Backpack,
  BookOpen,
  Compass,
  Edit3,
  Footprints,
  Moon,
  Plus,
  Scale,
  Shield,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import type { GameStore } from '@/hooks/use-game-store';
import {
  createEntityId,
  getDomainById,
  type CharacterProfile,
  type DomainId,
  type InventoryItem,
} from '@/lib/rpg-storage';
import { formatShortDateRu, pluralizeRu } from '@/lib/date-utils';
import { EpistemicLabel, PageHeading } from '@/components/page-heading';

const DOMAIN_ICONS: Record<DomainId, typeof Moon> = {
  recovery: Moon,
  body: Footprints,
  craft: Activity,
  resilience: Shield,
  chronicle: BookOpen,
};

function CharacterPortrait({ displayName }: { displayName: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = `${import.meta.env.BASE_URL}character-crest.jpg`;

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[#c4ad72]/35 bg-[#161a21] sm:h-24 sm:w-24">
      {!imgFailed ? (
        <img
          src={src}
          alt={`Портрет персонажа ${displayName}`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#c4ad72]/18 to-[#3a5c50]/18 text-[#d8c48e]">
          <Compass size={32} strokeWidth={1.4} />
        </div>
      )}
    </div>
  );
}

export function CharacterPage({ store }: { store: GameStore }) {
  const { character, entries, combinedWeights, goals, domainSnapshots, saveCharacter } = store;

  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(character.displayName);
  const [draftTitle, setDraftTitle] = useState(character.title);
  const [draftIdentity, setDraftIdentity] = useState(character.identityNote);
  const [draftValues, setDraftValues] = useState(character.values.join(', '));
  const [draftConstraints, setDraftConstraints] = useState(character.constraints);

  const [addingItem, setAddingItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCondition, setItemCondition] = useState('');
  const [itemNote, setItemNote] = useState('');

  const today = todayIso();
  const hasTodayEntry = entries.some((e) => e.date === today);
  const activeGoals = goals.filter((g) => g.status === 'active');
  const nextStepGoal = activeGoals.find((g) => g.nextStep.trim() !== '') ?? activeGoals[0];
  const latestWeight = combinedWeights[0];
  const latestEntry = entries[0];
  const isFirstVisit = entries.length === 0 && combinedWeights.length === 0 && !character.onboardingDismissed;

  const openProfileEditor = () => {
    setDraftName(character.displayName);
    setDraftTitle(character.title);
    setDraftIdentity(character.identityNote);
    setDraftValues(character.values.join(', '));
    setDraftConstraints(character.constraints);
    setEditingProfile(true);
  };

  const handleSaveProfile = (event: FormEvent) => {
    event.preventDefault();
    const cleanedValues = draftValues
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: CharacterProfile = {
      ...character,
      displayName: draftName.trim() || 'Путник',
      title: draftTitle.trim() || 'Путник личных земель',
      identityNote: draftIdentity.trim(),
      values: cleanedValues,
      constraints: draftConstraints.trim(),
    };
    saveCharacter(updated);
    setEditingProfile(false);
  };

  const handleAddInventoryItem = (event: FormEvent) => {
    event.preventDefault();
    if (!itemName.trim()) return;
    const nextItem: InventoryItem = {
      id: createEntityId('inv'),
      name: itemName.trim(),
      condition: itemCondition.trim(),
      note: itemNote.trim(),
    };
    saveCharacter({
      ...character,
      inventory: [nextItem, ...character.inventory],
    });
    setItemName('');
    setItemCondition('');
    setItemNote('');
    setAddingItem(false);
  };

  const handleRemoveInventoryItem = (id: string) => {
    saveCharacter({
      ...character,
      inventory: character.inventory.filter((item) => item.id !== id),
    });
  };

  const dismissOnboarding = () => {
    saveCharacter({ ...character, onboardingDismissed: true });
  };

  return (
    <div className="enter space-y-6">
      <PageHeading
        kicker="Лист персонажа · Реальная жизнь и развитие"
        title={character.displayName}
        description="Реальные действия напрямую связаны с направлениями развития персонажа. Факты, самооценка и неутверждённые игровые правила разделены явно."
        action={
          <>
            <Link
              href={hasTodayEntry ? `/journal?date=${today}` : '/journal'}
              className="btn-primary"
              data-testid="cta-log-day"
            >
              {hasTodayEntry ? <Edit3 size={15} /> : <Plus size={16} />}
              {hasTodayEntry ? 'Обновить сегодня' : 'Записать день'}
            </Link>
            <Link href="/weight" className="btn-secondary" data-testid="cta-log-weight">
              <Scale size={15} />
              Зафиксировать вес
            </Link>
          </>
        }
      />

      {isFirstVisit ? (
        <section
          className="panel rounded-2xl p-5 md:p-6"
          data-testid="card-first-visit-guide"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="text-[12px] font-semibold text-[#c4ad72]">
                Первый вход в Жадные игры
              </div>
              <h2 className="page-title mt-1 text-2xl text-[#f2eadb]">
                С чего начать маршрут
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-[#a6a7a0]">
                Здесь три слоя: твой персонаж, реальные факты дня (сон, вес, прогулки, дело, привычки) и игровые направления развития. Начни с любого одного действия — пустые поля никогда не считаются нулём.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/journal" className="btn-primary">
                  <Plus size={15} />
                  Внести первый день
                </Link>
                <Link href="/weight" className="btn-secondary">
                  <Scale size={15} />
                  Добавить первый вес
                </Link>
                <Link href="/goals" className="btn-secondary">
                  <Target size={15} />
                  Задать цель
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              aria-label="Скрыть подсказку"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#8d8e87] hover:bg-white/[0.05] hover:text-[#efe7d7]"
            >
              <X size={18} />
            </button>
          </div>
        </section>
      ) : null}

      {/* Hero Character Sheet */}
      <section
        className="panel relative overflow-hidden rounded-2xl p-5 md:p-7"
        data-testid="card-character-hero"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 sm:gap-5">
            <CharacterPortrait displayName={character.displayName} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#9c9d96]">
                <span className="text-[#c9b47a]">{character.title}</span>
                <span aria-hidden="true">·</span>
                <EpistemicLabel status="self-assessment" />
              </div>
              <h2
                className="page-title mt-1 text-[28px] leading-tight text-[#f2eadb] sm:text-[32px]"
                data-testid="text-character-name"
              >
                {character.displayName}
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#a6a7a0]">
                {character.identityNote ||
                  'Профиль пока не описан. Можно добавить личный фокус этапа, ценности и реальные ограничения — это отобразится как самооценка.'}
              </p>

              {(character.values.length > 0 || character.constraints) && (
                <div className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3 text-[12px]">
                  {character.values.length > 0 ? (
                    <div className="text-[#b8b5aa]">
                      <span className="text-[#8a8c92]">Ценности: </span>
                      {character.values.join(' · ')}
                    </div>
                  ) : null}
                  {character.constraints ? (
                    <div className="text-[#b8b5aa]">
                      <span className="text-[#8a8c92]">Ограничения: </span>
                      {character.constraints}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
            <div className="rounded-xl border border-white/[0.08] bg-[#14181f]/80 px-4 py-3 text-left lg:min-w-[230px]">
              <div className="text-[11px] text-[#8d8e94]">
                Игровой уровень и XP
              </div>
              <div
                className="mt-1 text-[14px] font-semibold text-[#ded7c8]"
                data-testid="text-rpg-rules-slot"
              >
                Правила не утверждены
              </div>
              <div className="mt-0.5 text-[11px] text-[#8a8c92]">
                Формулы начислений отключены
              </div>
            </div>
            <button
              type="button"
              onClick={openProfileEditor}
              className="btn-secondary"
              data-testid="button-edit-character"
            >
              <Edit3 size={14} />
              Настроить профиль
            </button>
          </div>
        </div>

        {/* Fact Summary Strip */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.08] pt-5 lg:grid-cols-4">
          <div>
            <div className="text-[12px] text-[#8f9196]">Последний вес</div>
            <div
              className="metric-value mt-1 text-[26px] text-[#f0e8d8]"
              data-testid="summary-latest-weight"
            >
              {latestWeight ? `${latestWeight.weightKg} кг` : '—'}
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a8c92]">
              {latestWeight ? (
                <>
                  <EpistemicLabel status="confirmed" /> ·{' '}
                  {formatShortDateRu(latestWeight.date)}
                </>
              ) : (
                <EpistemicLabel status="unknown" />
              )}
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[#8f9196]">Записей в дневнике</div>
            <div className="metric-value mt-1 text-[26px] text-[#f0e8d8]">
              {entries.length}
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a8c92]">
              {latestEntry ? (
                <>
                  <EpistemicLabel status="confirmed" /> · посл.{' '}
                  {formatShortDateRu(latestEntry.date)}
                </>
              ) : (
                <EpistemicLabel status="unknown" />
              )}
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[#8f9196]">Замеров веса</div>
            <div className="metric-value mt-1 text-[26px] text-[#f0e8d8]">
              {combinedWeights.length}
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a8c92]">
              {combinedWeights.length > 0 ? (
                <EpistemicLabel status="confirmed" />
              ) : (
                <EpistemicLabel status="unknown" />
              )}
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[#8f9196]">Активных целей</div>
            <div className="metric-value mt-1 text-[26px] text-[#f0e8d8]">
              {activeGoals.length}
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a8c92]">
              {activeGoals.length > 0 ? (
                <EpistemicLabel status="self-assessment" />
              ) : (
                <EpistemicLabel status="unknown" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Inline Profile Editor */}
      {editingProfile ? (
        <form
          onSubmit={handleSaveProfile}
          className="panel rounded-2xl p-5 md:p-6"
          data-testid="form-character-profile"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="page-title m-0 text-2xl text-[#f2eadb]">
                Идентичность персонажа
              </h2>
              <p className="mt-1 text-[12px] text-[#8d8e94]">
                Все поля профиля маркируются как самооценка и не подменяют факты.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="grid h-11 w-11 place-items-center rounded-lg text-[#9c9d96] hover:bg-white/[0.06]"
              aria-label="Закрыть редактирование профиля"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
                Имя персонажа
              </span>
              <input
                className="field"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Например, Усатый ЖИФ"
                data-testid="input-character-name"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
                Роль или титул
              </span>
              <input
                className="field"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Путник личных земель"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
                Кто я сейчас (описание и контекст этапа)
              </span>
              <textarea
                className="field min-h-[84px]"
                value={draftIdentity}
                onChange={(e) => setDraftIdentity(e.target.value)}
                placeholder="Коротко о текущем этапе жизни и на чём ты держишь внимание"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
                Ценности и опоры (через запятую)
              </span>
              <input
                className="field"
                value={draftValues}
                onChange={(e) => setDraftValues(e.target.value)}
                placeholder="Ясность, здоровье, самостоятельность"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#d2cec3]">
                Реальные ограничения
              </span>
              <input
                className="field"
                value={draftConstraints}
                onChange={(e) => setDraftConstraints(e.target.value)}
                placeholder="Например, плотный рабочий график, восстановление режима"
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
              data-testid="button-save-character"
            >
              Сохранить профиль
            </button>
          </div>
        </form>
      ) : null}

      {/* Next Step Spotlight */}
      <section className="panel rounded-2xl p-5 md:p-6" data-testid="section-next-step">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-[#9c9d96]">
              <span className="font-semibold text-[#c4ad72]">Следующий шаг</span>
              <span aria-hidden="true">·</span>
              <EpistemicLabel status={nextStepGoal ? 'self-assessment' : 'unknown'} />
              {nextStepGoal ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{getDomainById(nextStepGoal.domainId).shortLabel}</span>
                </>
              ) : null}
            </div>
            {nextStepGoal ? (
              <>
                <h2 className="page-title mt-1 text-2xl text-[#f2eadb]">
                  {nextStepGoal.title}
                </h2>
                <p className="mt-1.5 text-[14px] leading-6 text-[#c5c2b8]">
                  {nextStepGoal.nextStep || 'Следующий конкретный шаг пока не расписан.'}
                </p>
              </>
            ) : (
              <>
                <h2 className="page-title mt-1 text-2xl text-[#f2eadb]">
                  Цель и следующий шаг ещё не заданы
                </h2>
                <p className="mt-1.5 text-[13px] leading-6 text-[#9c9d96]">
                  Задай одну реальную цель и понятное ближайшее действие в выбранном направлении развития.
                </p>
              </>
            )}
          </div>
          <Link href="/goals" className="btn-secondary self-start sm:self-center">
            {nextStepGoal ? 'Все цели' : 'Задать цель'}
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* Development Domains — Real Life <-> RPG Link */}
      <section aria-labelledby="domains-heading">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2
              id="domains-heading"
              className="page-title m-0 text-[28px] text-[#f2eadb]"
            >
              Направления развития персонажа
            </h2>
            <p className="mt-1 text-[13px] text-[#9c9d96]">
              Каждое направление опирается на реальные наблюдения. Очки опыта и уровни не начисляются до утверждения правил.
            </p>
          </div>
          <div className="text-[12px] text-[#8a8c92]">
            <EpistemicLabel status="confirmed" /> · <EpistemicLabel status="self-assessment" /> ·{' '}
            <EpistemicLabel status="unknown" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {domainSnapshots.map((snapshot) => {
            const Icon = DOMAIN_ICONS[snapshot.domain.id];
            const ratio = Math.min(7, snapshot.recordsLast7Days);
            const actionHref = snapshot.domain.id === 'body' ? '/weight' : '/journal';
            const actionLabel = snapshot.domain.id === 'body' ? 'Зафиксировать вес' : 'Записать день';

            return (
              <article
                key={snapshot.domain.id}
                className="panel flex flex-col justify-between rounded-2xl p-5"
                data-testid={`domain-card-${snapshot.domain.id}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-[#8f9196]">
                        <EpistemicLabel status={snapshot.epistemicStatus} />
                        {snapshot.activeGoalsCount > 0 ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {snapshot.activeGoalsCount}{' '}
                              {pluralizeRu(snapshot.activeGoalsCount, 'цель', 'цели', 'целей')}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <h3 className="page-title mt-1 text-[23px] leading-snug text-[#f0e8d8]">
                        {snapshot.domain.name}
                      </h3>
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#c4ad72]/20 bg-[#c4ad72]/10 text-[#c9b47a]">
                      <Icon size={18} />
                    </div>
                  </div>

                  {/* Latest confirmed fact */}
                  <div className="mt-4 border-t border-white/[0.07] pt-3.5">
                    {snapshot.latestConfirmed ? (
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[12px] text-[#9a9b94]">
                            {snapshot.latestConfirmed.label}
                          </span>
                          <span className="mono text-[11px] text-[#7f8289]">
                            {formatShortDateRu(snapshot.latestConfirmed.date)}
                          </span>
                        </div>
                        <div className="metric-value mt-1 text-[28px] leading-tight text-[#f2eadb]">
                          {snapshot.latestConfirmed.value}
                        </div>
                        {snapshot.deltaLabel ? (
                          <div className="mt-1 text-[12px] text-[#b8a572]">
                            {snapshot.deltaLabel}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-[13px] text-[#8a8c92]">
                        Подтверждённых записей пока нет.
                      </div>
                    )}

                    {snapshot.latestSelfAssessment ? (
                      <div className="mt-2.5 flex items-baseline justify-between gap-2 text-[12px] text-[#b8b5aa]">
                        <span>
                          {snapshot.latestSelfAssessment.label}:{' '}
                          <strong className="font-semibold text-[#e6dfd1]">
                            {snapshot.latestSelfAssessment.value}
                          </strong>
                        </span>
                        <span className="mono text-[11px] text-[#7f8289]">
                          {formatShortDateRu(snapshot.latestSelfAssessment.date)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-3.5">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-[#8f9196]">
                      <span>Наблюдения за 7 дней</span>
                      <span className="mono text-[#d0c9ba]">{ratio} / 7</span>
                    </div>
                    <div
                      className="mt-1.5 grid grid-cols-7 gap-1"
                      aria-label={`Наблюдений за 7 дней: ${ratio} из 7`}
                    >
                      {Array.from({ length: 7 }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 rounded-sm ${
                            i < ratio ? 'bg-[#c4ad72]' : 'bg-white/[0.08]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] leading-5 text-[#8a8c92]">
                    Связь: {snapshot.domain.realLifeInputs}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
                    <span className="text-[#7c7f86]">{snapshot.rpgSlotNote}</span>
                    <Link
                      href={actionHref}
                      className="font-semibold text-[#c9b47a] hover:text-[#e2cd92]"
                    >
                      {actionLabel} →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Bottom 2-column split: Real-Life Inventory & RPG Rules Architecture */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel rounded-2xl p-5 md:p-6" data-testid="section-inventory">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[12px] text-[#9c9d96]">
                <Backpack size={14} className="text-[#c4ad72]" />
                <span>Реальные предметы</span>
                <span aria-hidden="true">·</span>
                <EpistemicLabel status={character.inventory.length > 0 ? 'self-assessment' : 'unknown'} />
              </div>
              <h2 className="page-title mt-1 text-2xl text-[#f2eadb]">
                Снаряжение и вещи
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAddingItem((v) => !v)}
              className="btn-secondary"
              data-testid="button-toggle-add-inventory"
            >
              <Plus size={14} />
              Добавить
            </button>
          </div>

          {addingItem ? (
            <form onSubmit={handleAddInventoryItem} className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Предмет (напр. Кроссовки, весы)"
                  data-testid="input-inventory-name"
                />
                <input
                  className="field"
                  value={itemCondition}
                  onChange={(e) => setItemCondition(e.target.value)}
                  placeholder="Состояние (напр. рабочее)"
                />
              </div>
              <input
                className="field"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                placeholder="Заметка (опционально)"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddingItem(false)}
                  className="btn-secondary"
                >
                  Отмена
                </button>
                <button type="submit" className="btn-primary" data-testid="button-save-inventory">
                  Сохранить предмет
                </button>
              </div>
            </form>
          ) : null}

          {character.inventory.length === 0 ? (
            <p className="mt-4 text-[13px] leading-6 text-[#8f9196]">
              Список реальных вещей пока пуст. Сюда можно записывать важные предметы повседневной жизни и их состояние — база для будущего игрового инвентаря.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.07]">
              {character.inventory.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#e9e2d4]">
                      {item.name}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#8f9196]">
                      {item.condition ? `Состояние: ${item.condition}` : 'Состояние не указано'}
                      {item.note ? ` · ${item.note}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveInventoryItem(item.id)}
                    aria-label={`Удалить ${item.name}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#8f9196] hover:bg-white/[0.05] hover:text-[#e89f96]"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-2 text-[12px] text-[#9c9d96]">
            <Shield size={14} className="text-[#c4ad72]" />
            <span>Границы Alpha-версии</span>
          </div>
          <h2 className="page-title mt-1 text-2xl text-[#f2eadb]">
            Игровой слой без вымышленных формул
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-[#9c9d96]">
            Архитектура уже связывает реальные действия с направлениями развития персонажа, но автоматические расчёты намеренно не включены до утверждения правил владельцем:
          </p>
          <dl className="mt-4 space-y-2.5 border-t border-white/[0.07] pt-4 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[#8f9196]">Опыт (XP) и уровни</dt>
              <dd className="text-right text-[#d2cec3]">Не начисляются · слот готов</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#8f9196]">Награды и штрафы</dt>
              <dd className="text-right text-[#d2cec3]">Отключены</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#8f9196]">Хранение данных</dt>
              <dd className="text-right text-[#d2cec3]">Локально на устройстве + JSON-бэкап</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
