import { NavLink, Outlet } from 'react-router-dom';
import { OFFICE_TZ } from '@rbs/shared';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Room Booking</span>
        <nav className="nav">
          <NavLink to="/" end>
            Day view
          </NavLink>
          <NavLink to="/my-bookings">My bookings</NavLink>
        </nav>
        <div className="user">
          <span className="user__name">{user?.name}</span>
          <button type="button" className="btn btn--ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">All times in office time ({OFFICE_TZ})</footer>
    </div>
  );
}
