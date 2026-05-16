import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

function formatMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Quiz() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading'); // loading | waiting | intro | running | finished
  const [quizStatus, setQuizStatus] = useState(null); // disabled | enabled | closed
  const [questions, setQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [deadlineTs, setDeadlineTs] = useState(null); // timestamp absolu de fin
  const [remainingMs, setRemainingMs] = useState(0);
  const [savedAnswers, setSavedAnswers] = useState({}); // questionId -> answerId
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState('');
  const [finalResult, setFinalResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Init : charge l'état + questions
  useEffect(() => {
    (async () => {
      try {
        const stateResp = await api.state();
        const state = stateResp.state;
        if (state && (state.status === 'submitted' || state.status === 'timeout')) {
          setFinalResult(state);
          setPhase('finished');
          return;
        }
        const q = await api.questions();
        setQuestions(q.questions);
        if (state && state.status === 'in_progress') {
          setAttemptId(state.attemptId);
          setSavedAnswers(state.savedAnswers || {});
          setDeadlineTs(Date.now() + state.remainingMs);
          setPhase('running');
          return;
        }
        // Pas de tentative en cours : on regarde si l'admin a activé le quiz
        const s = await api.quizStatus();
        setQuizStatus(s.status);
        if (s.status === 'enabled') {
          setPhase('intro');
        } else {
          setPhase('waiting');
        }
      } catch (err) {
        setError(err.message);
        setPhase('intro');
      }
    })();
  }, []);

  // Polling du statut quiz pendant la phase d'attente
  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = setInterval(async () => {
      try {
        const s = await api.quizStatus();
        setQuizStatus(s.status);
        if (s.status === 'enabled') setPhase('intro');
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [phase]);

  // Timer : décompte précis basé sur deadlineTs (résiste aux décalages)
  useEffect(() => {
    if (phase !== 'running' || !deadlineTs) return;
    const tick = () => {
      const rem = deadlineTs - Date.now();
      setRemainingMs(rem);
      if (rem <= 0) handleTimeout();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadlineTs]);

  const start = async () => {
    try {
      const r = await api.start();
      setAttemptId(r.attemptId);
      setDeadlineTs(Date.now() + r.remainingMs);
      setPhase('running');
    } catch (err) {
      if (err.status === 403) {
        setError('Vous avez déjà passé le quiz. Une seule tentative est autorisée.');
      } else if (err.status === 423) {
        // L'admin a désactivé/clôturé entre temps
        setQuizStatus(err.payload?.quizStatus || 'disabled');
        setPhase('waiting');
      } else {
        setError(err.message);
      }
    }
  };

  const selectAnswer = async (questionId, answerId) => {
    setSavedAnswers((prev) => ({ ...prev, [questionId]: answerId }));
    try {
      await api.saveAnswer({ attemptId, questionId, answerId });
    } catch (err) {
      if (err.status === 410) {
        handleTimeout();
      } else {
        // garde l'UI optimiste mais signale
        setError('Erreur de sauvegarde de la réponse');
      }
    }
  };

  const finalize = async (reason = 'manual') => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const r = await api.submit({ attemptId });
      setFinalResult(r);
      setPhase('finished');
    } catch (err) {
      if (err.status === 403 || err.status === 410) {
        // déjà soumis ou timeout côté serveur, on re-fetch l'état final
        try {
          const stateResp = await api.state();
          setFinalResult(stateResp.state);
          setPhase('finished');
        } catch {
          setError(err.message);
        }
      } else {
        setError(err.message);
        submittedRef.current = false;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTimeout = () => finalize('timeout');

  if (phase === 'loading') {
    return <div className="text-center py-20 heading-serif text-2xl">Chargement…</div>;
  }

  if (phase === 'finished' && finalResult) {
    return <Results result={finalResult} onLogout={async () => {
      try { await api.logout(); } catch {}
      navigate('/login');
    }}/>;
  }

  if (phase === 'waiting') {
    return (
      <div className="max-w-2xl mx-auto animate-fade-up">
        <div className="card p-8 sm:p-12 text-center space-y-6">
          <div className="inline-block">
            <span className="badge-pill">
              {quizStatus === 'closed' ? 'Concours clôturé' : 'En attente de l\'organisateur'}
            </span>
          </div>
          <h1 className="heading-script text-5xl text-bordeaux-700">
            {quizStatus === 'closed' ? 'C\'est terminé' : 'Patientez quelques instants…'}
          </h1>
          {quizStatus === 'closed' ? (
            <p className="font-serif text-xl text-ink-800/80 leading-relaxed">
              Le concours est officiellement clôturé. Merci à toutes et tous d'avoir participé !
            </p>
          ) : (
            <>
              <p className="font-serif text-xl text-ink-800/80 leading-relaxed">
                Le quiz n'est pas encore ouvert. Restez sur cette page :<br />
                le démarrage se fera <strong>automatiquement</strong> dès que l'organisateur lancera le concours.
              </p>
              <div className="flex justify-center pt-2">
                <span className="inline-flex items-center gap-2 text-bordeaux-700">
                  <span className="w-2 h-2 bg-bordeaux-600 rounded-full animate-pulse-slow"></span>
                  <span className="text-sm">Vérification toutes les 3 secondes</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="max-w-2xl mx-auto animate-fade-up">
        <div className="card p-8 sm:p-10 text-center space-y-6">
          <h1 className="heading-script text-5xl text-bordeaux-700">Prêt ?</h1>
          <p className="font-serif text-xl">Vous allez commencer le quiz APELAV 2026</p>
          <ul className="text-left max-w-md mx-auto space-y-2 text-ink-800/80">
            <li>• <strong>17 questions</strong> à choix unique</li>
            <li>• <strong>10 minutes</strong> chronométrées</li>
            <li>• <strong>1 seule tentative</strong> par personne</li>
            <li>• Score final ramené sur <strong>20</strong></li>
            <li>• En cas d'égalité, le <strong>temps</strong> départage</li>
          </ul>
          {error && (
            <div className="rounded-xl bg-bordeaux-600/10 text-bordeaux-700 p-3 text-sm">
              {error}
            </div>
          )}
          <button onClick={start} className="btn-primary w-full sm:w-auto px-8">
            Démarrer le quiz
          </button>
        </div>
      </div>
    );
  }

  // phase === running
  const q = questions[current];
  const answered = savedAnswers[q?.id];
  const total = questions.length;
  const answeredCount = Object.keys(savedAnswers).length;
  const timeLow = remainingMs < 60_000; // dernière minute

  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      {/* Barre timer + progression */}
      <div className="sticky top-16 z-10 mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3
                      backdrop-blur-md bg-white/70 border-b border-rose-100/60">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-ink-800/70">
            Question <span className="font-bold text-bordeaux-700">{current + 1}</span> / {total}
            <span className="hidden sm:inline ml-3">· {answeredCount} répondue(s)</span>
          </div>
          <div className={`heading-serif text-2xl tabular-nums font-bold
                          ${timeLow ? 'text-bordeaux-700 animate-pulse-slow' : 'text-ink-900'}`}>
            ⏱ {formatMs(remainingMs)}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-rose-100 overflow-hidden">
          <div className="h-full bg-bordeaux-600 transition-all"
               style={{ width: `${((current + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="heading-serif text-2xl sm:text-3xl leading-snug mb-6">
          {q.enonce}
        </h2>

        <div className="space-y-3">
          {q.answers.map((a, idx) => {
            const isSelected = answered === a.id;
            return (
              <button
                key={a.id}
                onClick={() => selectAnswer(q.id, a.id)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all
                            flex items-center gap-3
                            ${isSelected
                              ? 'border-bordeaux-600 bg-bordeaux-600/5 shadow-card'
                              : 'border-rose-200 bg-white hover:border-rose-300 hover:bg-rose-50'}`}
              >
                <span className={`flex-shrink-0 w-8 h-8 rounded-full border-2 grid place-items-center
                                  text-sm font-bold
                                  ${isSelected
                                    ? 'border-bordeaux-600 bg-bordeaux-600 text-white'
                                    : 'border-rose-300 text-rose-500'}`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1">{a.texte}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="btn-secondary"
        >
          ← Précédente
        </button>

        {current < total - 1 ? (
          <button
            onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
            className="btn-primary"
          >
            Suivante →
          </button>
        ) : (
          <button
            onClick={() => finalize('manual')}
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? 'Envoi…' : 'Terminer le quiz'}
          </button>
        )}
      </div>

      {/* Navigation rapide (numéros) */}
      <div className="mt-8 grid grid-cols-9 sm:grid-cols-17 gap-2 max-w-2xl mx-auto">
        {questions.map((qq, i) => {
          const isAnsw = savedAnswers[qq.id];
          const isCur = i === current;
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              className={`aspect-square rounded-lg text-xs font-semibold transition-all
                          ${isCur ? 'ring-2 ring-bordeaux-600 ring-offset-1' : ''}
                          ${isAnsw
                            ? 'bg-bordeaux-600 text-white'
                            : 'bg-white border border-rose-200 text-ink-800/60 hover:bg-rose-50'}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Results({ result, onLogout }) {
  // Brief : "Une fois les 10 min passé, on est automatiquement exit de l'application"
  // → on déconnecte automatiquement après affichage du remerciement
  useEffect(() => {
    const t = setTimeout(onLogout, 12000); // 12s pour lire la phrase
    return () => clearTimeout(t);
  }, [onLogout]);

  const isTimeout = result.status === 'timeout';

  return (
    <div className="max-w-2xl mx-auto animate-fade-up">
      <div className="card p-8 sm:p-12 text-center space-y-6">
        {isTimeout && (
          <span className="badge-pill bg-bordeaux-600/10 text-bordeaux-700">
            Temps écoulé
          </span>
        )}
        <h1 className="heading-script text-6xl text-bordeaux-700">Merci !</h1>
        <p className="font-serif text-xl text-ink-800/80 leading-relaxed">
          Votre participation au quiz a bien été enregistrée.
        </p>

        {/* Phrase de remerciement religieuse */}
        <div className="py-8 space-y-4">
          <p className="font-serif text-4xl sm:text-5xl text-bordeaux-700"
             dir="rtl" lang="ar"
             style={{ fontFamily: '"Amiri", "Cormorant Garamond", serif' }}>
            جَزَاكُمُ اللَّهُ خَيْرًا
          </p>
          <p className="heading-script text-3xl sm:text-4xl text-bordeaux-700">
            Jazākum Allāhu khayran
          </p>
          <p className="font-serif text-lg italic text-ink-800/70 max-w-md mx-auto">
            « Qu'Allah vous récompense par le bien »
          </p>
        </div>

        <p className="text-sm text-ink-800/70 leading-relaxed">
          Les résultats seront annoncés sur place par l'organisateur.<br />
          <span className="italic">Barakallahu fikum</span> pour votre participation.
        </p>

        <p className="text-xs text-ink-800/50 italic pt-2">
          Vous allez être automatiquement déconnecté…
        </p>
        <button onClick={onLogout} className="btn-secondary">
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
