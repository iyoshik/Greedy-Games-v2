# Журнал разработки Alpha — «Жадные Игры»

## Этап 1 — Инфраструктура, запуск в AI Studio и чистый TypeScript
- **Реализовано:** настроены корневые npm-скрипты (`dev`, `build`, `lint`, `test`), снят блок `preinstall` для `npm`, добавлены дефолты `PORT=3000` и `BASE_PATH=/` в `vite.config.ts`, Replit-плагины переведены в условную загрузку, добавлен `metadata.json`, обновлён `index.html` (метатеги для iPhone/Safari, шрифты Cormorant Garamond + Manrope + JetBrains Mono), заменён favicon и сгенерирован портретный герб персонажа (`public/character-crest.jpg`).
- **Изменённые файлы:** `package.json`, `metadata.json`, `artifacts/zhadnye-igry/package.json`, `artifacts/zhadnye-igry/vite.config.ts`, `artifacts/zhadnye-igry/index.html`, `artifacts/zhadnye-igry/public/favicon.svg`, `artifacts/zhadnye-igry/public/character-crest.jpg`, `artifacts/zhadnye-igry/src/components/ui/chart.tsx`, `artifacts/zhadnye-igry/src/components/ui/input-otp.tsx`.
- **Исправленные ошибки:** устранены 11 ошибок TypeScript в шаблонных UI-компонентах и падение Vite без `PORT`/`BASE_PATH`.

## Этап 2 — Безопасный слой данных, отдельный вес, профиль, направления развития и цели
- **Реализовано:**
  - `src/lib/journal-storage.ts` — сохранена 100% обратная совместимость с ключом `zhadnye-igry-journal-v1`, добавлено определение повреждённого JSON без перезаписи, иммутабельная сортировка, нормализация запятой в десятичных числах (русская клавиатура iOS), строгая валидация диапазонов, опциональные поля `energyLevel` и `workFocus`.
  - `src/lib/weight-storage.ts` — независимая сущность `WeightMeasurement` (`zhadnye-igry-weight-v1`) с поддержкой нескольких замеров в день, времени, контекста, валидации и неразрушающим мостом для прежних значений `weightKg` из записей дневника.
  - `src/lib/rpg-storage.ts` — профиль персонажа (`CharacterProfile` + список реальных вещей), цели и следующий шаг (`GoalItem`), расчёт честных срезов 5 направлений развития (`computeDomainSnapshots`) с явным разделением «Подтверждено / Самооценка / Нет данных» и зарезервированным слотом без вымышленных формул XP, а также экспорт/валидация JSON-бэкапа.
  - `src/lib/date-utils.ts` — форматирование дат и точное русское склонение.
- **Проверки:** `npm test` — 9 из 9 unit-тестов пройдены (`journal-storage.test.ts` + `weight-and-rpg.test.ts`).

## Этап 3 — Интерфейс Alpha (Персонаж, Дневник, Вес, Цели, История)
- **Реализовано:**
  - `src/hooks/use-game-store.ts` — единый React-store с защитой от перезаписи повреждённого `localStorage` при монтировании.
  - `src/App.tsx` — стабильные компоненты маршрутов через контекст (исправлено перемонтирование страниц при изменении состояния), адаптивная 5-раздельная навигация для iPhone и десктопа.
  - `src/pages/character-page.tsx` — главный экран персонажа с портретом, профилем, активным следующим шагом, 5 направлениями развития, реальными предметами и прозрачным слотом неутверждённых RPG-правил.
  - `src/pages/journal-page.tsx` — дневник с защитой от конфликта дат, маркировкой фактов и самооценки, поддержкой запятой в числах.
  - `src/pages/weight-page.tsx` — отдельный экран измерений веса с формой, графиком реальных точек и списком замеров.
  - `src/pages/goals-page.tsx` — цели и следующий шаг с привязкой к направлениям и отображением ближайшего подтверждённого факта.
  - `src/pages/history-page.tsx` — единая лента (Всё / Дневник / Вес) + локальный экспорт и импорт JSON-бэкапа.
  - Локализованы `error-boundary.tsx` и `not-found.tsx` в тёмной русскоязычной теме.

## Этап 4 — Верификация, доработка крайних случаев и запуск Alpha
- **Доработки:**
  - Усилена защита от потери введённых данных в `JournalPage` при переключении даты на уже занятую.
  - Добавлен прямой переход из «Истории» в редактирование конкретного замера веса (`/weight?edit=<id>`).
  - Добавлена умная кнопка на главном экране персонажа («Обновить сегодня» при наличии записи за сегодня / «Записать день»).
  - Усилена санитизация при импорте JSON-бэкапа (`parseBackupSnapshot` прогоняет каждый раздел через строгие парсеры).
- **Проверки:**
  - `npm test` — все unit-тесты (journal, weight, rpg, sanitization) пройдены.
  - `npm run lint` (`tsc -p tsconfig.json --noEmit`) — 0 ошибок.
  - `npm run build` (`vite build`) — успешная production-сборка.
  - Живой dev-сервер на порту `3000`: HTTP 200 на `/`, `/journal`, `/weight`, `/goals`, `/history`, `/character`, `/character-crest.jpg`, `/favicon.svg`.

