import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', prenom: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const r = await api.register({
        nom: form.nom, prenom: form.prenom, password: form.password,
      });
      // Brief : redirection vers login avec username (nom&prenom) pré-rempli
      navigate(`/login?u=${encodeURIComponent(r.suggestedUsername)}`);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto animate-fade-up">
      <div className="text-center mb-8">
        <h1 className="heading-script text-5xl text-bordeaux-700">Inscription</h1>
        <p className="font-serif italic text-ink-800/70 mt-2">
          Créez votre compte pour participer au concours
        </p>
      </div>

      <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
        {error && (
          <div className="rounded-xl bg-bordeaux-600/10 text-bordeaux-700 p-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm text-ink-800/80 mb-1.5">Nom</label>
          <input className="input" type="text" required maxLength={80}
                 value={form.nom} onChange={update('nom')} autoComplete="family-name" />
        </div>

        <div>
          <label className="block text-sm text-ink-800/80 mb-1.5">Prénom</label>
          <input className="input" type="text" required maxLength={80}
                 value={form.prenom} onChange={update('prenom')} autoComplete="given-name" />
        </div>

        <div>
          <label className="block text-sm text-ink-800/80 mb-1.5">Mot de passe</label>
          <input className="input" type="password" required minLength={6} maxLength={200}
                 value={form.password} onChange={update('password')} autoComplete="new-password" />
        </div>

        <div>
          <label className="block text-sm text-ink-800/80 mb-1.5">Confirmer le mot de passe</label>
          <input className="input" type="password" required minLength={6} maxLength={200}
                 value={form.confirm} onChange={update('confirm')} autoComplete="new-password" />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Inscription en cours…' : 'Créer mon compte'}
        </button>

        <p className="text-center text-sm text-ink-800/70">
          Déjà inscrit ?{' '}
          <a href="/login" className="text-bordeaux-700 underline">Se connecter</a>
        </p>
      </form>
    </div>
  );
}
