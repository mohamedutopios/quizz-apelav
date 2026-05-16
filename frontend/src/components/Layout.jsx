import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/auth.jsx';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-full deco-leaves">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/60 border-b border-rose-100/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="heading-script text-3xl sm:text-4xl leading-none">Apelav</span>
            <span className="hidden sm:inline-block text-xs uppercase tracking-[0.2em] text-bordeaux-700 border-l border-rose-200 pl-3">
              Quiz Concours 2026
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            {user ? (
              <>
                {user.role === 'admin' && (
                  <Link to="/admin" className="btn-ghost text-bordeaux-700">Admin</Link>
                )}
                <span className="hidden sm:inline text-ink-800/70">@{user.username}</span>
                <button onClick={handleLogout} className="btn-secondary py-2 px-4 text-sm">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Connexion</Link>
                <Link to="/register" className="btn-primary py-2 px-4 text-sm">Inscription</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {children}
      </main>

      <footer className="mt-16 py-8 border-t border-rose-100/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-ink-800/60">
          <p className="font-serif italic">Association des Parents d'élèves — Lycée Averroès</p>
          <p className="mt-1 text-xs">65 rue de la Prévoyance · 59000 Lille</p>
        </div>
      </footer>
    </div>
  );
}
