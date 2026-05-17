import { Link } from 'react-router-dom';
import { useAuth } from '../api/auth.jsx';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="grid md:grid-cols-2 gap-10 items-center animate-fade-up">
      {/* Hero text */}
      <div className="space-y-6">
        <span className="badge-pill">Concours · Samedi 23 mai 2026</span>
        <h1 className="heading-script text-6xl sm:text-7xl md:text-8xl leading-[0.95]">
          Quiz<br />Apelav
        </h1>
        <p className="heading-serif text-2xl sm:text-3xl text-bordeaux-700">
          Tentez votre chance et gagnez de nombreux lots avec notre quiz
        </p>
        <p className="text-ink-800/75 max-w-md leading-relaxed">
          Quiz · 10 minutes chrono · une seule tentative.
          Le meilleur score remporte la victoire. Bonne chance !
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {user ? (
            <Link
              to={user.role === 'admin' ? '/admin' : '/quiz'}
              className="btn-primary"
            >
              {user.role === 'admin' ? 'Aller au tableau de bord' : 'Commencer le quiz'}
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary">Je m'inscris</Link>
              <Link to="/login" className="btn-secondary">J'ai déjà un compte</Link>
            </>
          )}
        </div>
      </div>

      {/* Hero card visuel (photo du flyer) */}
      <div className="relative">
        <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden shadow-soft relative">
          <img
            src="/journee-shopping.jpg"
            alt="Journée Shopping APELAV - 23 mai 2026"
            className="w-full h-full object-cover"
            loading="eager"
          />
          {/* Légère superposition pour fondu avec la palette */}
          <div className="absolute inset-0 bg-gradient-to-t from-rose-100/40 via-transparent to-transparent pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
