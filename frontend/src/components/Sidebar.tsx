import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { api, mathApi, WritingType, MathTopic, Worksheet, MathWorksheet } from '@/lib/api';
import { worksheetStartState } from '@/lib/worksheet-start';
import { ChevronRight, Home, Menu, Shield, X, Zap } from 'lucide-react';

// "Evening Navy" sidebar (docs/mocks/example2.html): a solid deep-navy rail with
// a weekly momentum ring, colour-coded per-topic scores, an "Up next" pending
// worksheet card, and a focus mode that collapses the rail during timed tests.

type Band = 'strong' | 'mid' | 'weak' | 'none';

const band = (score: number | null | undefined): Band =>
  score == null ? 'none' : score >= 70 ? 'strong' : score >= 50 ? 'mid' : 'weak';

// Heatmap-scale text colours, tuned for legibility on the navy rail…
const scoreText: Record<Band, string> = {
  strong: 'text-[#43b573]',
  mid: 'text-[#f2a71b]',
  weak: 'text-[#ee7b6e]',
  none: 'text-rail-muted',
};
// …and darker variants for inside the white active pill.
const scoreTextActive: Record<Band, string> = {
  strong: 'text-[#1e7c46]',
  mid: 'text-[#b07708]',
  weak: 'text-[#c2372c]',
  none: 'text-gray-400',
};
const stripFill: Record<Band, string> = {
  strong: 'bg-[#43b573]',
  mid: 'bg-[#f2a71b]',
  weak: 'bg-[#ee7b6e]',
  none: 'bg-[#33507a]',
};

const SESSION_GOAL = 5;

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  return d;
}

type Pending = { kind: 'writing'; ws: Worksheet } | { kind: 'math'; ws: MathWorksheet };

function ScoreBadge({ score, active }: { score: number | null | undefined; active: boolean }) {
  const b = band(score);
  return (
    <span
      className={cn(
        'ml-auto text-[10.5px] shrink-0',
        b === 'none' ? 'font-medium' : 'font-bold',
        active ? scoreTextActive[b] : scoreText[b]
      )}
    >
      {score == null ? '—' : `${score}%`}
    </span>
  );
}

export default function Sidebar() {
  const [types, setTypes] = useState<WritingType[]>([]);
  const [mathTopics, setMathTopics] = useState<MathTopic[]>([]);
  const [writingScores, setWritingScores] = useState<Record<string, number | null>>({});
  const [mathScores, setMathScores] = useState<Record<string, number | null>>({});
  const [sessions, setSessions] = useState(0);
  const [upNext, setUpNext] = useState<Pending | null>(null);
  const [writingExpanded, setWritingExpanded] = useState(true);
  const [mathExpanded, setMathExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // A timed test is running — collapse the rail so nothing competes with it.
  const focusMode = /\/start$/.test(location.pathname);

  useEffect(() => {
    api.getTypes().then(setTypes).catch(() => {});
    mathApi.getTopics().then(setMathTopics).catch(() => {});
  }, []);

  // Scores, momentum and pending worksheets change as the student works, so
  // refresh them on every navigation.
  useEffect(() => {
    if (focusMode) return;
    api
      .getHeatmap()
      .then((h) => setWritingScores(Object.fromEntries(h.map((e) => [e.typeSlug, e.averageScore]))))
      .catch(() => {});
    mathApi
      .getHeatmap()
      .then((h) => setMathScores(Object.fromEntries(h.map((e) => [e.topicSlug, e.averageScore]))))
      .catch(() => {});
    Promise.all([api.getAttempts(), mathApi.getAttempts()])
      .then(([w, m]) => {
        const since = startOfWeek().getTime();
        setSessions([...w, ...m].filter((a) => new Date(a.finishedAt).getTime() >= since).length);
      })
      .catch(() => {});
    Promise.all([api.getWorksheets(), mathApi.getWorksheets()])
      .then(([w, m]) => {
        const pending: Pending[] = [
          ...w.filter((ws) => (ws.attempts || []).length === 0).map((ws) => ({ kind: 'writing' as const, ws })),
          ...m.filter((ws) => (ws.attempts || []).length === 0).map((ws) => ({ kind: 'math' as const, ws })),
        ];
        pending.sort((a, b) => new Date(a.ws.createdAt).getTime() - new Date(b.ws.createdAt).getTime());
        setUpNext(pending[0] || null);
      })
      .catch(() => {});
  }, [location.pathname, focusMode]);

  const isActive = (slug: string) => location.pathname.includes(slug);

  const startUpNext = async () => {
    if (!upNext) return;
    setMobileOpen(false);
    if (upNext.kind === 'math') {
      const slugs: string[] = JSON.parse(upNext.ws.topicIds || '[]');
      navigate(`/math/${slugs[0] || 'all-topics'}/start`, { state: { worksheetId: upNext.ws.id } });
    } else {
      const brief = types.find((t) => t.id === upNext.ws.typeId);
      if (!brief) return;
      const full = await api.getType(brief.slug);
      navigate(`/practice/${full.slug}/start`, { state: worksheetStartState(full, upNext.ws) });
    }
  };

  if (focusMode) {
    return (
      <aside
        data-testid="sidebar-focus"
        aria-label="Focus mode — navigation hidden during a timed test"
        className="hidden lg:flex w-14 bg-rail flex-col items-center py-4 shrink-0 h-full"
      >
        <div
          className="w-9 h-9 rounded-[10px] bg-brand-amber grid place-items-center"
          title="Focus mode — the sidebar returns when the test ends"
        >
          <Zap size={16} className="text-rail" fill="currentColor" />
        </div>
      </aside>
    );
  }

  const done = Math.min(sessions, SESSION_GOAL);
  const ringC = 2 * Math.PI * 22;
  const encouragement =
    sessions >= SESSION_GOAL ? 'Goal met — brilliant work!' : sessions > 0 ? 'Nice pace — keep it up!' : 'Ready when you are.';

  const itemClass = (active: boolean) =>
    cn(
      'flex items-center gap-2 pl-3 pr-2.5 py-[7px] rounded-lg text-[13px] transition-colors',
      active ? 'bg-white text-rail font-bold' : 'text-rail-text hover:bg-rail-raise'
    );

  const groupHead =
    'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-semibold text-rail-text hover:bg-rail-raise transition-colors';

  const sectLabel = 'px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[.14em] text-rail-muted';

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'w-64 bg-rail flex flex-col shrink-0 h-full transition-transform',
          'lg:relative lg:translate-x-0',
          mobileOpen ? 'fixed inset-y-0 left-0 z-40 translate-x-0' : 'fixed -translate-x-full lg:relative lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 pt-5">
          <div className="w-9 h-9 rounded-[10px] bg-brand-amber grid place-items-center shrink-0">
            <Zap size={17} className="text-rail" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white leading-tight">Selective Coach</h1>
            <p className="text-[9.5px] font-semibold uppercase tracking-[.14em] text-rail-muted mt-0.5">
              NSW Selective Prep
            </p>
          </div>
        </div>

        {/* Weekly momentum — celebrates effort (sessions), not scores */}
        <div className="mx-3 mt-4 p-3 rounded-xl bg-rail-raise flex items-center gap-3">
          <div className="relative w-[52px] h-[52px] shrink-0">
            <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
              <circle cx="26" cy="26" r="22" fill="none" stroke="#1a3a61" strokeWidth="5" />
              <circle
                cx="26"
                cy="26"
                r="22"
                fill="none"
                stroke="#2e9e5b"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={ringC * (1 - done / SESSION_GOAL)}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-[13px] font-bold text-white">
              {done}/{SESSION_GOAL}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[.12em] text-rail-muted">This week</div>
            <div className="text-[13px] font-semibold text-white mt-0.5">
              {sessions} of {SESSION_GOAL} sessions done
            </div>
            <div className="text-[11.5px] text-rail-muted mt-0.5">{encouragement}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <Link
            to="/dashboard"
            onClick={() => setMobileOpen(false)}
            className={itemClass(location.pathname === '/dashboard')}
          >
            <Home size={15} className={location.pathname === '/dashboard' ? '' : 'text-rail-muted'} />
            Dashboard
          </Link>

          <div className={sectLabel}>Subjects</div>

          {/* Writing */}
          <div>
            <button onClick={() => setWritingExpanded(!writingExpanded)} className={groupHead}>
              <span className="w-2 h-2 rounded-full bg-[#5b9de8] shrink-0" />
              <span>Writing</span>
              <span className="ml-auto text-[11px] font-normal text-rail-muted">{types.length} types</span>
              <ChevronRight
                size={13}
                className={cn('text-rail-muted transition-transform shrink-0', writingExpanded && 'rotate-90')}
              />
            </button>
            {!writingExpanded && (
              <div className="flex flex-wrap gap-[3px] px-3 pb-2 pl-[26px]" title="Writing strength at a glance">
                {types.map((t) => (
                  <span key={t.slug} className={cn('w-[9px] h-[9px] rounded-[2.5px]', stripFill[band(writingScores[t.slug])])} />
                ))}
              </div>
            )}
            {writingExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {types.map((type) => {
                  const active = isActive(type.slug);
                  return (
                    <Link
                      key={type.slug}
                      to={`/practice/${type.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className={itemClass(active)}
                    >
                      <span className="truncate">{type.name}</span>
                      <ScoreBadge score={writingScores[type.slug]} active={active} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mathematics */}
          <div className="mt-1">
            <button onClick={() => setMathExpanded(!mathExpanded)} className={groupHead}>
              <span className="w-2 h-2 rounded-full bg-[#43b573] shrink-0" />
              <span>Mathematics</span>
              <span className="ml-auto text-[11px] font-normal text-rail-muted">{mathTopics.length} topics</span>
              <ChevronRight
                size={13}
                className={cn('text-rail-muted transition-transform shrink-0', mathExpanded && 'rotate-90')}
              />
            </button>
            {!mathExpanded && (
              <div className="flex flex-wrap gap-[3px] px-3 pb-2 pl-[26px]" title="Mathematics strength at a glance">
                {mathTopics.map((t) => (
                  <span key={t.slug} className={cn('w-[9px] h-[9px] rounded-[2.5px]', stripFill[band(mathScores[t.slug])])} />
                ))}
              </div>
            )}
            {mathExpanded && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                <Link
                  to="/math/all-topics"
                  onClick={() => setMobileOpen(false)}
                  className={itemClass(isActive('all-topics'))}
                >
                  <span className="truncate">All Topics</span>
                </Link>
                {mathTopics.map((topic) => {
                  const active = isActive(topic.slug);
                  return (
                    <Link
                      key={topic.slug}
                      to={`/math/${topic.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className={itemClass(active)}
                    >
                      <span className="truncate">{topic.name}</span>
                      <ScoreBadge score={mathScores[topic.slug]} active={active} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className={sectLabel}>Coach</div>
          <Link to="/admin" onClick={() => setMobileOpen(false)} className={itemClass(location.pathname === '/admin')}>
            <Shield size={15} className={location.pathname === '/admin' ? '' : 'text-rail-muted'} />
            Admin
          </Link>
        </nav>

        {/* Up next — the oldest pending worksheet, one tap away */}
        {upNext && (
          <div className="p-3 pt-1 shrink-0">
            <div className="rounded-xl bg-rail-raise p-3 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-brand-amber shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[9.5px] font-bold uppercase tracking-[.12em] text-brand-amber">Up next</div>
                <div className="text-xs font-semibold text-white truncate mt-0.5">{upNext.ws.title}</div>
              </div>
              <button
                onClick={startUpNext}
                className="shrink-0 bg-brand-green text-white text-[11.5px] font-bold px-3 py-1.5 rounded-lg hover:bg-[#278a4f] transition-colors"
              >
                Start
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/30 z-30" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
