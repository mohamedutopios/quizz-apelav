import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

function formatDuration(ms) {
  if (ms == null) return '—';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

const TABS = [
  { id: 'dashboard',    label: 'Vue d\'ensemble' },
  { id: 'ranking',      label: 'Classement' },
  { id: 'participants', label: 'Participants' },
  { id: 'questions',    label: 'Questions' },
];

export default function Admin() {
  const [tab, setTab] = useState('dashboard');
  const [detailAttemptId, setDetailAttemptId] = useState(null);

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="heading-script text-5xl text-bordeaux-700">Tableau de bord</h1>
        <p className="font-serif italic text-ink-800/70 mt-1">
          Pilotage du quiz APELAV 2026
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all
                        ${tab === t.id
                          ? 'bg-bordeaux-600 text-white shadow-card'
                          : 'bg-white border border-rose-200 text-ink-800/70 hover:bg-rose-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard'    && <Dashboard />}
      {tab === 'ranking'      && <Ranking onOpenDetail={setDetailAttemptId} />}
      {tab === 'participants' && <Participants onOpenDetail={setDetailAttemptId} />}
      {tab === 'questions'    && <Questions />}

      {detailAttemptId !== null && (
        <AttemptDetailModal attemptId={detailAttemptId} onClose={() => setDetailAttemptId(null)} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try { setStats(await api.adminDashboard()); } catch {}
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 5000); // rafraîchit toutes les 5s
    return () => clearInterval(id);
  }, [load]);

  const setStatus = async (status) => {
    setActing(true);
    try {
      await api.adminSetStatus(status);
      await load();
    } finally {
      setActing(false);
    }
  };

  if (!stats) return <p>Chargement…</p>;

  const cards = [
    { label: 'Inscrits',     value: stats.totalUsers, color: 'bg-rose-300' },
    { label: 'En ligne',     value: stats.online,     color: 'bg-beige-300' },
    { label: 'En cours',     value: stats.inProgress, color: 'bg-rose-200' },
    { label: 'Terminés',     value: stats.completed,  color: 'bg-bordeaux-600 text-white' },
  ];

  const statusLabel = {
    disabled: { txt: 'En attente', badge: 'bg-beige-200 text-ink-900' },
    enabled:  { txt: 'En cours',   badge: 'bg-green-100 text-green-800' },
    closed:   { txt: 'Clôturé',    badge: 'bg-bordeaux-600/10 text-bordeaux-700' },
  }[stats.quizStatus] || { txt: stats.quizStatus, badge: 'bg-rose-200' };

  return (
    <div className="space-y-6">
      {/* Bandeau de contrôle d'état du quiz */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-ink-800/60">État du quiz</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusLabel.badge}`}>
                {statusLabel.txt}
              </span>
              {stats.activatedAt && (
                <span className="text-xs text-ink-800/50">
                  démarré le {new Date(stats.activatedAt).toLocaleString('fr-FR')}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.quizStatus !== 'enabled' && (
              <button
                onClick={() => setStatus('enabled')}
                disabled={acting}
                className="btn-primary py-2 px-5 text-sm"
              >
                {stats.quizStatus === 'disabled' ? '▶ Démarrer le quiz' : '↻ Relancer'}
              </button>
            )}
            {stats.quizStatus === 'enabled' && (
              <button
                onClick={() => {
                  if (confirm('Clôturer le quiz ? Les participants ne pourront plus démarrer une nouvelle tentative. Les tentatives en cours continueront jusqu\'à leur terme.')) {
                    setStatus('closed');
                  }
                }}
                disabled={acting}
                className="btn-secondary py-2 px-5 text-sm text-bordeaux-700"
              >
                ■ Clôturer
              </button>
            )}
            {stats.quizStatus !== 'disabled' && (
              <button
                onClick={() => {
                  if (confirm('Remettre en attente ? Les participants n\'ayant pas encore démarré verront la page d\'attente.')) {
                    setStatus('disabled');
                  }
                }}
                disabled={acting}
                className="btn-ghost py-2 px-5 text-sm"
              >
                Mettre en attente
              </button>
            )}
            <a
              href="/admin/podium"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-2 px-5 text-sm bg-beige-500 hover:bg-beige-300 text-ink-900"
            >
              🏆 Affichage podium
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-800/60 italic">
          Tant que le quiz est « En attente », les participants voient une page d'attente — ils ne peuvent pas démarrer.
          Cliquez sur « Démarrer le quiz » au moment opportun pour ouvrir le concours.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`card p-6 ${c.color}`}>
            <p className="text-sm opacity-80">{c.label}</p>
            <p className="heading-serif text-5xl font-bold mt-1 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function Ranking({ onOpenDetail }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const { ranking } = await api.adminRanking();
        if (!stopped) setRows(ranking);
      } finally { if (!stopped) setLoading(false); }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  if (loading) return <p>Chargement du classement…</p>;
  if (rows.length === 0) return <p className="text-ink-800/70">Aucun participant n'a encore terminé le quiz.</p>;

  const podiumMedal = (rang) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[rang] || rang);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-rose-100/60 text-ink-900">
            <tr className="text-left">
              <th className="p-3 sm:p-4">Rang</th>
              <th className="p-3 sm:p-4">Participant</th>
              <th className="p-3 sm:p-4 text-center">Score /20</th>
              <th className="p-3 sm:p-4 text-center">Bonnes rép.</th>
              <th className="p-3 sm:p-4 text-center">Temps</th>
              <th className="p-3 sm:p-4 text-center hidden sm:table-cell">Statut</th>
              <th className="p-3 sm:p-4 text-center">Détail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-rose-100 hover:bg-rose-50/40">
                <td className="p-3 sm:p-4 font-bold text-bordeaux-700">
                  {podiumMedal(r.rang)}
                </td>
                <td className="p-3 sm:p-4">
                  <div className="font-medium">{r.prenom} {r.nom}</div>
                  <div className="text-xs text-ink-800/50">@{r.username}</div>
                </td>
                <td className="p-3 sm:p-4 text-center heading-serif text-xl font-bold">
                  {r.score.toFixed(2)}
                </td>
                <td className="p-3 sm:p-4 text-center">{r.correct} / {r.total}</td>
                <td className="p-3 sm:p-4 text-center tabular-nums">{formatDuration(r.durationMs)}</td>
                <td className="p-3 sm:p-4 text-center hidden sm:table-cell">
                  {r.status === 'timeout' ? (
                    <span className="px-2 py-0.5 rounded-full bg-bordeaux-600/10 text-bordeaux-700 text-xs">
                      Timeout
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-200 text-bordeaux-700 text-xs">
                      Soumis
                    </span>
                  )}
                </td>
                <td className="p-3 sm:p-4 text-center">
                  <button onClick={() => onOpenDetail(r.attemptId)}
                          className="btn-secondary py-1 px-3 text-xs">
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function Participants({ onOpenDetail }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const { participants } = await api.adminParticipants();
        if (!stopped) setRows(participants);
      } finally { if (!stopped) setLoading(false); }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { stopped = true; clearInterval(id); };
  }, []);

  if (loading) return <p>Chargement…</p>;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-rose-100/60 text-ink-900">
            <tr className="text-left">
              <th className="p-3 sm:p-4">Participant</th>
              <th className="p-3 sm:p-4 text-center">En ligne</th>
              <th className="p-3 sm:p-4 text-center">Quiz</th>
              <th className="p-3 sm:p-4 text-center">Score</th>
              <th className="p-3 sm:p-4 text-center">Détail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-rose-100 hover:bg-rose-50/40">
                <td className="p-3 sm:p-4">
                  <div className="font-medium">{p.prenom} {p.nom}</div>
                  <div className="text-xs text-ink-800/50">@{p.username}</div>
                </td>
                <td className="p-3 sm:p-4 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full
                                    ${p.online ? 'bg-green-500 animate-pulse-slow' : 'bg-rose-200'}`}></span>
                </td>
                <td className="p-3 sm:p-4 text-center">
                  {p.attempt ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs
                                      ${p.attempt.status === 'in_progress'
                                        ? 'bg-beige-200 text-ink-900'
                                        : p.attempt.status === 'timeout'
                                          ? 'bg-bordeaux-600/10 text-bordeaux-700'
                                          : 'bg-rose-200 text-bordeaux-700'}`}>
                      {p.attempt.status === 'in_progress' ? 'En cours' :
                       p.attempt.status === 'timeout' ? 'Timeout' : 'Terminé'}
                    </span>
                  ) : (
                    <span className="text-ink-800/40 text-xs">Pas commencé</span>
                  )}
                </td>
                <td className="p-3 sm:p-4 text-center font-medium">
                  {p.attempt?.score !== null && p.attempt?.score !== undefined
                    ? `${p.attempt.score.toFixed(2)}/20`
                    : '—'}
                </td>
                <td className="p-3 sm:p-4 text-center">
                  {p.attempt ? (
                    <button onClick={() => onOpenDetail(p.attempt.id)}
                            className="btn-secondary py-1 px-3 text-xs">
                      Voir
                    </button>
                  ) : (
                    <span className="text-ink-800/30 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
function Questions() {
  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | {question}
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { questions } = await api.adminQuestions();
      setQuestions(questions);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!confirm('Supprimer définitivement cette question ?')) return;
    await api.adminDeleteQ(id);
    await load();
  };

  if (loading) return <p>Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-ink-800/70">{questions.length} question(s)</p>
        <button onClick={() => setEditing('new')} className="btn-primary">
          + Nouvelle question
        </button>
      </div>

      {editing && (
        <QuestionEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}

      <div className="grid gap-3">
        {questions.map((q) => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start gap-3">
              <span className="badge-pill text-xs">#{q.ordre}</span>
              <div className="flex-1">
                <p className="heading-serif text-lg">{q.enonce}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {q.answers.map((a) => (
                    <li key={a.id} className={a.isCorrect ? 'text-green-700 font-medium' : 'text-ink-800/70'}>
                      {a.isCorrect ? '✓' : '○'} {a.texte}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setEditing(q)} className="btn-secondary py-1.5 px-3 text-xs">
                  Modifier
                </button>
                <button onClick={() => remove(q.id)} className="btn-ghost py-1.5 px-3 text-xs text-bordeaux-700">
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionEditor({ initial, onClose, onSaved }) {
  const [enonce, setEnonce] = useState(initial?.enonce || '');
  const [active, setActive] = useState(initial ? initial.active : true);
  const [answers, setAnswers] = useState(
    initial?.answers?.map((a) => ({ texte: a.texte, isCorrect: a.isCorrect })) ||
    [
      { texte: '', isCorrect: true },
      { texte: '', isCorrect: false },
      { texte: '', isCorrect: false },
      { texte: '', isCorrect: false },
    ]
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setCorrect = (idx) =>
    setAnswers((arr) => arr.map((a, i) => ({ ...a, isCorrect: i === idx })));

  const updateText = (idx, v) =>
    setAnswers((arr) => arr.map((a, i) => (i === idx ? { ...a, texte: v } : a)));

  const addAnswer = () =>
    setAnswers((arr) => (arr.length < 6 ? [...arr, { texte: '', isCorrect: false }] : arr));

  const removeAnswer = (idx) =>
    setAnswers((arr) => (arr.length > 2 ? arr.filter((_, i) => i !== idx) : arr));

  const save = async () => {
    setError(''); setSaving(true);
    try {
      const payload = { enonce: enonce.trim(), active, answers };
      if (initial) await api.adminUpdateQ(initial.id, payload);
      else         await api.adminCreateQ(payload);
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="card p-6 border-2 border-bordeaux-600/30">
      <h3 className="heading-serif text-xl mb-4">
        {initial ? `Modifier la question #${initial.ordre}` : 'Nouvelle question'}
      </h3>

      {error && (
        <div className="rounded-xl bg-bordeaux-600/10 text-bordeaux-700 p-3 text-sm mb-3">
          {error}
        </div>
      )}

      <textarea
        className="input min-h-[80px]" value={enonce}
        onChange={(e) => setEnonce(e.target.value)}
        placeholder="Énoncé de la question…"
      />

      <div className="mt-4 space-y-2">
        {answers.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={a.isCorrect}
              onChange={() => setCorrect(i)}
              className="w-5 h-5 accent-bordeaux-600"
              title="Marquer comme bonne réponse"
            />
            <input
              className="input flex-1"
              value={a.texte}
              onChange={(e) => updateText(i, e.target.value)}
              placeholder={`Réponse ${String.fromCharCode(65 + i)}`}
            />
            {answers.length > 2 && (
              <button onClick={() => removeAnswer(i)}
                      className="btn-ghost p-2 text-bordeaux-700">×</button>
            )}
          </div>
        ))}
        {answers.length < 6 && (
          <button onClick={addAnswer} className="btn-secondary py-1.5 px-3 text-xs">
            + Ajouter une réponse
          </button>
        )}
      </div>

      <label className="flex items-center gap-2 mt-4 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Question active (visible dans le quiz)
      </label>

      <div className="mt-6 flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Annuler</button>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Modale : détail des réponses d'un participant (pour contestations)
// ----------------------------------------------------------------
function AttemptDetailModal({ attemptId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api.adminAttempt(attemptId);
        if (!cancelled) setData(d);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  // Fermer avec Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const att = data?.attempt;

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
         onClick={onClose}>
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-soft overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-rose-100 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="heading-serif text-2xl text-bordeaux-700">Détail de la tentative</h2>
          <button onClick={onClose}
                  className="w-8 h-8 grid place-items-center rounded-full hover:bg-rose-100"
                  aria-label="Fermer">×</button>
        </div>

        <div className="p-6 space-y-6">
          {loading && <p className="text-center py-8">Chargement…</p>}
          {error && (
            <div className="rounded-xl bg-bordeaux-600/10 text-bordeaux-700 p-3 text-sm">
              {error}
            </div>
          )}
          {data && att && (
            <>
              {/* En-tête participant + score */}
              <div className="bg-rose-50/60 rounded-2xl p-5">
                <p className="heading-serif text-xl">
                  {att.prenom} {att.nom}
                </p>
                <p className="text-sm text-ink-800/60">@{att.username}</p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-ink-800/50">Score</p>
                    <p className="heading-serif text-2xl font-bold text-bordeaux-700">
                      {att.score !== null ? att.score.toFixed(2) : '—'}/20
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-ink-800/50">Bonnes rép.</p>
                    <p className="font-medium text-lg">
                      {att.correctCount} / {att.totalCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-ink-800/50">Temps</p>
                    <p className="font-medium text-lg">{formatDuration(att.durationMs)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-ink-800/50">Statut</p>
                    <p className="font-medium">
                      {att.status === 'submitted' ? 'Soumis' :
                       att.status === 'timeout'   ? 'Timeout' :
                       att.status === 'in_progress' ? 'En cours' : att.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Liste des questions */}
              <div className="space-y-3">
                {data.questions.map((q) => {
                  const noAnswer = q.userAnswerId === null;
                  const isCorrect = q.userIsCorrect === true;
                  return (
                    <div key={q.id}
                         className={`rounded-2xl border-2 p-4
                                     ${isCorrect
                                       ? 'border-green-300 bg-green-50/40'
                                       : noAnswer
                                         ? 'border-rose-200 bg-rose-50/40'
                                         : 'border-bordeaux-600/30 bg-bordeaux-600/5'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full grid place-items-center
                                          text-sm font-bold
                                          ${isCorrect
                                            ? 'bg-green-500 text-white'
                                            : noAnswer
                                              ? 'bg-rose-200 text-ink-800/60'
                                              : 'bg-bordeaux-600 text-white'}`}>
                          {isCorrect ? '✓' : noAnswer ? '○' : '✗'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs uppercase tracking-widest text-ink-800/50">
                            Question {q.ordre}
                          </p>
                          <p className="heading-serif text-lg mt-0.5">{q.enonce}</p>
                          <div className="mt-3 space-y-1.5 text-sm">
                            {q.answers.map((a) => {
                              const isChosen = q.userAnswerId === a.id;
                              const isRight = a.isCorrect;
                              let style = 'text-ink-800/60';
                              let prefix = '○';
                              if (isRight && isChosen) { style = 'text-green-700 font-semibold'; prefix = '✓'; }
                              else if (isRight)        { style = 'text-green-700';                prefix = '✓'; }
                              else if (isChosen)       { style = 'text-bordeaux-700 font-semibold'; prefix = '✗'; }
                              return (
                                <div key={a.id} className={`flex items-start gap-2 ${style}`}>
                                  <span className="flex-shrink-0">{prefix}</span>
                                  <span>{a.texte}</span>
                                  {isChosen && (
                                    <span className="ml-auto text-xs italic">
                                      (cochée par le participant)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {noAnswer && (
                            <p className="mt-2 text-xs italic text-ink-800/50">
                              Le participant n'a pas répondu à cette question.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-rose-100 px-6 py-3 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Fermer</button>
        </div>
      </div>
    </div>
  );
}
