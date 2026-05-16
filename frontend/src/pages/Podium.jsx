import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

/**
 * Page plein écran pour la projection du podium devant le public.
 * Conçue pour être ouverte dans un onglet séparé par l'admin et projetée
 * sur grand écran. Hors du Layout standard (header retiré).
 *
 * Comportement :
 *  - Au chargement : 3 socles vides 3ème / 2ème / 1er, en gris
 *  - 1er clic : révèle le 3ème
 *  - 2ème clic : révèle le 2ème
 *  - 3ème clic : révèle le 1er (avec confettis et fanfare visuelle)
 *  - 4ème clic : reset
 */
export default function Podium() {
  const [ranking, setRanking] = useState(null);
  const [revealed, setRevealed] = useState(0); // 0 → 3 (nombre de places dévoilées)
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { ranking } = await api.adminRanking();
      setRanking(ranking);
    } catch (err) {
      setError(err.message || 'Impossible de charger le classement (êtes-vous connecté admin ?)');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Espace ou flèche droite = clic suivant, R = reset, F = plein écran
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault();
        setRevealed((r) => (r < 3 ? r + 1 : 0));
      } else if (e.code === 'KeyR') {
        setRevealed(0);
      } else if (e.code === 'KeyF') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
      } else if (e.code === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleClick = () => setRevealed((r) => (r < 3 ? r + 1 : 0));

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50 p-8">
        <div className="card p-8 max-w-md text-center">
          <p className="text-bordeaux-700 font-medium">{error}</p>
          <a href="/admin" className="btn-primary mt-4 inline-block">Retour à l'admin</a>
        </div>
      </div>
    );
  }

  if (!ranking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rose-50">
        <p className="heading-serif text-2xl">Chargement du classement…</p>
      </div>
    );
  }

  const top3 = ranking.slice(0, 3);
  const winner1 = top3[0] || null;
  const winner2 = top3[1] || null;
  const winner3 = top3[2] || null;

  return (
    <div
      onClick={handleClick}
      className="min-h-screen w-full overflow-hidden cursor-pointer select-none
                 flex flex-col"
      style={{
        background:
          'radial-gradient(at 20% 0%, #F0D2CF 0%, transparent 60%), ' +
          'radial-gradient(at 80% 100%, #EFE0C8 0%, transparent 60%), ' +
          '#FBF3F2',
      }}
    >
      {/* Bandeau supérieur — dans le flux normal, plus petit pour laisser de la place au podium */}
      <header className="shrink-0 py-3 sm:py-5 text-center">
        <p className="heading-script text-4xl sm:text-5xl text-bordeaux-700 leading-none">
          Apelav
        </p>
        <p className="font-serif italic text-sm sm:text-lg text-ink-800/70 mt-1">
          Quiz Concours 2026 — Résultats
        </p>
      </header>

      {/* Podium — prend tout l'espace, aligné en bas */}
      <main className="flex-1 flex items-end justify-center px-4 pb-4 min-h-0">
        <div className="flex items-end gap-3 sm:gap-6 lg:gap-10 w-full max-w-6xl justify-center">
          <PodiumPlace
            rank={3}
            participant={winner3}
            revealed={revealed >= 1}
            heightClass="h-28 sm:h-40 lg:h-52"
          />
          <PodiumPlace
            rank={1}
            participant={winner1}
            revealed={revealed >= 3}
            heightClass="h-52 sm:h-72 lg:h-[22rem]"
            isWinner
          />
          <PodiumPlace
            rank={2}
            participant={winner2}
            revealed={revealed >= 2}
            heightClass="h-40 sm:h-56 lg:h-64"
          />
        </div>
      </main>

      {/* Aide en bas */}
      <footer className="shrink-0 py-3 text-center text-xs text-ink-800/40 px-4">
        Cliquez (ou Espace) pour révéler la position suivante · R pour recommencer · F plein écran
        <span className="mx-2">·</span>
        Étape {revealed} / 3
      </footer>

      {/* Confettis pour le 1er */}
      {revealed >= 3 && winner1 && <Confetti />}
    </div>
  );
}

// ----------------------------------------------------------------
function PodiumPlace({ rank, participant, revealed, heightClass, isWinner }) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const colors = {
    1: { bar: 'from-amber-400 to-yellow-200', text: 'text-amber-900' },
    2: { bar: 'from-zinc-400 to-zinc-200', text: 'text-zinc-800' },
    3: { bar: 'from-orange-700 to-orange-400', text: 'text-orange-100' },
  };

  return (
    <div className="flex flex-col items-center flex-1 max-w-xs">
      {/* Carte participant au-dessus du socle */}
      <div
        className={`mb-4 transition-all duration-700 ease-out
                    ${revealed
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-8 scale-90'}`}
      >
        {revealed && participant ? (
          <div className={`bg-white rounded-3xl shadow-soft px-5 py-4 sm:px-8 sm:py-6 text-center
                           ${isWinner ? 'ring-4 ring-amber-300 animate-pulse-slow' : ''}`}>
            <div className="text-4xl sm:text-6xl mb-1">{medals[rank]}</div>
            <p className="heading-serif text-xl sm:text-3xl font-bold text-bordeaux-700 leading-tight">
              {participant.prenom}
            </p>
            <p className="heading-serif text-base sm:text-xl text-ink-900 leading-tight">
              {participant.nom}
            </p>
            <div className="mt-3 pt-3 border-t border-rose-100 space-y-0.5">
              <p className="heading-serif text-2xl sm:text-4xl font-bold text-bordeaux-700 tabular-nums">
                {participant.score.toFixed(2)}<span className="text-base text-ink-800/50">/20</span>
              </p>
              <p className="text-xs sm:text-sm text-ink-800/60">
                {participant.correct}/{participant.total} bonnes · {formatDuration(participant.durationMs)}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 text-center opacity-30">
            <div className="text-4xl">{medals[rank]}</div>
          </div>
        )}
      </div>

      {/* Socle */}
      <div className={`w-full ${heightClass} rounded-t-3xl bg-gradient-to-b ${colors[rank].bar}
                       shadow-soft flex items-start justify-center pt-4 sm:pt-6
                       transition-all duration-500 ${revealed ? 'scale-100' : 'scale-95 opacity-70'}`}>
        <span className={`heading-script text-7xl sm:text-9xl ${colors[rank].text} drop-shadow-md`}>
          {rank}
        </span>
      </div>
    </div>
  );
}

function formatDuration(ms) {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

// ----------------------------------------------------------------
// Petits confettis CSS pour célébrer le 1er
function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-20">
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 3 + Math.random() * 3;
        const colors = ['#C98785', '#E8C5C5', '#E8D4B0', '#8B3A3A', '#D9BC8B'];
        const color = colors[i % colors.length];
        const size = 8 + Math.random() * 6;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-20px',
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * 0.4}px`,
              background: color,
              borderRadius: '2px',
              animation: `confetti-fall ${duration}s linear ${delay}s infinite`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
