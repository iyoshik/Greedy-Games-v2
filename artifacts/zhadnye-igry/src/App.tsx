import { createContext, type ReactNode, useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Compass,
  Plus,
  Scale,
  Target,
  UserRound,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGameStore, type GameStore } from '@/hooks/use-game-store';
import { CharacterPage } from '@/pages/character-page';
import { JournalPage } from '@/pages/journal-page';
import { WeightPage } from '@/pages/weight-page';
import { GoalsPage } from '@/pages/goals-page';
import { HistoryPage } from '@/pages/history-page';
import NotFound from '@/pages/not-found';

const GameStoreContext = createContext<GameStore | null>(null);

function useStoreContext(): GameStore {
  const ctx = useContext(GameStoreContext);
  if (!ctx) {
    throw new Error('GameStoreContext is not initialized');
  }
  return ctx;
}

const navItems = [
  { href: '/', label: 'Персонаж', icon: UserRound },
  { href: '/journal', label: 'Дневник', icon: BookOpen },
  { href: '/weight', label: 'Вес', icon: Scale },
  { href: '/goals', label: 'Цели', icon: Target },
  { href: '/history', label: 'История', icon: CalendarDays },
];

function isNavActive(location: string, href: string) {
  if (href === '/') return location === '/' || location === '/character';
  return location === href;
}

function CharacterRoute() {
  const store = useStoreContext();
  return <CharacterPage store={store} />;
}

function JournalRoute() {
  const store = useStoreContext();
  return <JournalPage store={store} />;
}

function WeightRoute() {
  const store = useStoreContext();
  return <WeightPage store={store} />;
}

function GoalsRoute() {
  const store = useStoreContext();
  return <GoalsPage store={store} />;
}

function HistoryRoute() {
  const store = useStoreContext();
  return <HistoryPage store={store} />;
}

function Shell({ children }: { children: ReactNode }) {
  const store = useStoreContext();
  const [location] = useLocation();
  const activeNav = navItems.find((item) => isNavActive(location, item.href));
  const initials = store.character.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'ЖИ';

  return (
    <div className="app-shell min-h-[100dvh] md:flex">
      {/* Desktop Sidebar */}
      <aside className="sidebar fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col px-5 py-6 md:flex">
        <Link
          href="/"
          className="mb-10 flex items-center gap-3 px-2"
          data-testid="link-brand-home"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#c4ad72]/35 bg-[#c4ad72]/10 text-[#d3be84]">
            <Compass size={20} />
          </span>
          <span className="brand-mark whitespace-nowrap text-[22px] leading-none text-[#f2eadb]">
            Жадные игры
          </span>
        </Link>

        <nav className="space-y-1" aria-label="Основная навигация">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(location, href);
            return (
              <Link
                href={href}
                key={href}
                className={`nav-link ${active ? 'active' : ''}`}
                data-testid={`link-nav-${href === '/' ? 'character' : href.slice(1)}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={17} />
                <span className="whitespace-nowrap text-[14px] font-semibold">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/[0.08] bg-[#14181f]/80 p-4">
          <div className="text-[12px] font-semibold text-[#d3be84]">
            Честная RPG-хроника
          </div>
          <p className="mb-0 mt-1.5 text-[12px] leading-5 text-[#9a9b94]">
            Реальные действия связаны с направлениями развития. Игровые формулы не подменяют факты.
          </p>
          <div className="mono mt-3.5 flex justify-between border-t border-white/[0.07] pt-3 text-[11px] text-[#8a8c92]">
            <span>Дней: {store.entries.length}</span>
            <span>Вес: {store.combinedWeights.length}</span>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="min-w-0 flex-1 md:pl-[248px]">
        <header className="app-header sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/[0.07] bg-[#14181f]/90 px-4 backdrop-blur-xl md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="brand-mark whitespace-nowrap text-[21px] text-[#f2eadb] md:hidden"
            >
              Жадные игры
            </Link>
            <span className="hidden truncate text-[13px] font-medium text-[#9c9d96] md:block">
              {activeNav?.label ?? 'Журнал'}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {location !== '/journal' ? (
              <Link
                href="/journal"
                className="btn-primary min-h-9 px-3.5 text-[13px] md:min-h-10"
                data-testid="header-quick-log"
              >
                <Plus size={15} />
                Записать день
              </Link>
            ) : null}
            <Link
              href="/"
              className="hidden h-9 w-9 place-items-center rounded-full border border-[#c4ad72]/30 bg-[#c4ad72]/10 text-[11px] font-bold text-[#e2cd92] md:grid"
              aria-label="Профиль персонажа"
              data-testid="avatar-profile"
            >
              {initials}
            </Link>
          </div>
        </header>

        {store.hasCorruption ? (
          <div className="mx-auto mt-4 max-w-6xl px-4 md:px-10">
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-[#d5b97a]/40 bg-[#3d331d]/45 px-4 py-3 text-[13px] text-[#f0e0b6]"
              data-testid="status-corruption-warning"
            >
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-[#e0c482]" />
              <div>
                Часть данных в памяти браузера оказалась повреждена при чтении. Мы не перезаписываем её автоматически, чтобы избежать потери. Рекомендуем проверить раздел «История» и загрузить резервную копию при наличии.
              </div>
            </div>
          </div>
        ) : null}

        {store.storageWarning ? (
          <div className="mx-auto mt-4 max-w-6xl px-4 md:px-10">
            <div
              role="alert"
              className="rounded-xl border border-[#d66c61]/35 bg-[#5c2520]/35 px-4 py-3 text-[13px] text-[#f0b4ad]"
              data-testid="status-storage-warning"
            >
              {store.storageWarning}
            </div>
          </div>
        ) : null}

        <main className="app-content mx-auto max-w-6xl px-4 pt-5 md:px-10 md:pt-9">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (iPhone thumb zone, compact height) */}
      <nav
        className="mobile-navigation fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.08] bg-[#12151b]/95 px-1 pt-1.5 backdrop-blur-xl md:hidden"
        aria-label="Нижняя навигация"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(location, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-1 text-[10px] leading-tight font-semibold whitespace-nowrap ${
                active ? 'text-[#e2cd92]' : 'text-[#9b9c95]'
              }`}
              data-testid={`mobile-nav-${href === '/' ? 'character' : href.slice(1)}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={active ? 2.1 : 1.7} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRouter() {
  const store = useGameStore();
  return (
    <GameStoreContext.Provider value={store}>
      <RoutedErrorBoundary>
        <Shell>
          <Switch>
            <Route path="/" component={CharacterRoute} />
            <Route path="/character" component={CharacterRoute} />
            <Route path="/journal" component={JournalRoute} />
            <Route path="/weight" component={WeightRoute} />
            <Route path="/goals" component={GoalsRoute} />
            <Route path="/history" component={HistoryRoute} />
            <Route component={NotFound} />
          </Switch>
        </Shell>
      </RoutedErrorBoundary>
    </GameStoreContext.Provider>
  );
}

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
