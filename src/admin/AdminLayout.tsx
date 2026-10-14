import { Link, NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { fetchOpenReportCounts } from '../lib/api';
import { Logo } from '../components/Logo';

export default function AdminLayout() {
  const counts = useQuery({ queryKey: ['openReportCounts'], queryFn: fetchOpenReportCounts });
  const open = counts.data ? [...counts.data.values()].reduce((a, b) => a + b, 0) : 0;
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
  return (
    <div className="wide">
      <header className="top">
        <div className="row"><Logo /><span className="badge soft">Admin</span></div>
        <Link className="btn ghost sm" to="/">Ir a la app</Link>
      </header>
      <nav className="tabs">
        <NavLink to="/admin/reports" className={cls}>Reportes {open > 0 && <span className="badge">{open}</span>}</NavLink>
        <NavLink to="/admin/questions" className={cls}>Preguntas</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
