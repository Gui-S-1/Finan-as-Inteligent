import { NavLink } from 'react-router-dom';

const nav = [
  {
    to: '/',
    label: 'Home',
    d: 'M3 12l9-9 9 9M5 10v8a2 2 0 002 2h10a2 2 0 002-2v-8',
  },
  {
    to: '/contas',
    label: 'Contas',
    d: 'M6 2h12a1 1 0 011 1v18l-3-2-3 2-3-2-3 2V3a1 1 0 011-1zM9 7h6M9 11h6M9 15h3',
  },
  {
    to: '/lancamentos',
    label: 'Lanç.',
    d: 'M7 4v16m0 0l-3-3m3 3l3-3M17 20V4m0 0l3 3m-3-3l-3 3',
  },
  {
    to: '/consultor',
    label: 'Advisor',
    d: 'M9 21h6M12 3a6 6 0 00-4 10.5V17h8v-3.5A6 6 0 0012 3z',
  },
  {
    to: '/sandbox',
    label: 'Sandbox',
    d: 'M9 3h6M10 3v6l-5 8a1 1 0 00.85 1.5h12.3a1 1 0 00.85-1.5L14 9V3',
  },
  {
    to: '/metas',
    label: 'Metas',
    // target icon
    circles: true,
  },
];

export function NavDock() {
  return (
    <nav className="nav-dock" aria-label="Navegacao principal">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `dock-item${isActive ? ' active' : ''}`}
        >
          <svg className="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
            {item.circles ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
              </>
            ) : (
              <path d={item.d} />
            )}
          </svg>
          <span className="dock-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
