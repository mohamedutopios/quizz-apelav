import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../api/auth.jsx';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Brief : "redirigé vers la page de login avec le username (nom&prenom) pré-rempli"
  useEffect(() => {
    const u = params.get('u');
    if (u) setUsername(u);
  }, [params]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(username.trim().toLowerCase(), password);
      navigate(user.role === 'admin' ? '/admin' : '/quiz');
    } catch (err) {
      setError(err.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-fade-up">
      <div className="text-center mb-8">
        <h1 className="heading-script text-5xl text-bordeaux-700">Connexion</h1>
        <p className="font-serif italic text-ink-800/70 mt-2">
          Bon retour parmi nous
        </p>
      </div>

      <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
        {error && (
          <div className="rounded-xl bg-bordeaux-600/10 text-bordeaux-700 p-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-ink-800/80 mb-1.5">
            Identifiant <span className="text-xs text-ink-800/50">(nom&amp;prenom)</span>
          </label>
          <input className="input" type="text" required
                 value={username} onChange={(e) => setUsername(e.target.value)}
                 autoComplete="username" placeholder="nom&prenom" />
        </div>

        <div>
          <label className="block text-sm text-ink-800/80 mb-1.5">Mot de passe</label>
          <input className="input" type="password" required
                 value={password} onChange={(e) => setPassword(e.target.value)}
                 autoComplete="current-password" />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="text-center text-sm text-ink-800/70">
          Pas encore inscrit ?{' '}
          <Link to="/register" className="text-bordeaux-700 underline">Créer un compte</Link>
        </p>
      </form>
    </div>
  );
}
