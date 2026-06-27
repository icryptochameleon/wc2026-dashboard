import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'ホーム', icon: '🏠' },
  { to: '/players', label: '選手', icon: '👤' },
  { to: '/tournament', label: '対戦表', icon: '🏆' },
  { to: '/stats', label: '統計', icon: '📊' },
  { to: '/simulation', label: '予想', icon: '🎲' },
  { to: '/settings', label: '設定', icon: '⚙️' },
];

export function TabBar() {
  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 sm:hidden bg-navy-800/95 backdrop-blur border-t border-white/10 safe-bottom">
        <ul className="grid grid-cols-6">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center py-2 text-xs gap-0.5 ${
                    isActive ? 'text-gold-500' : 'text-slate-400'
                  }`
                }
              >
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="leading-none">{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop top bar */}
      <nav className="hidden sm:block sticky top-[57px] z-20 bg-navy-900/95 backdrop-blur border-b border-white/5">
        <ul className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
                    isActive
                      ? 'border-gold-500 text-gold-500'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`
                }
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
