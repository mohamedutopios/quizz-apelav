const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, options = {}) {
  const hasBody = options.body !== undefined && options.body !== null;
  const headers = { ...(options.headers || {}) };
  if (hasBody) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(data?.error || `Erreur ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register:    (body) => request('/api/auth/register', { method: 'POST', body }),
  login:       (body) => request('/api/auth/login',    { method: 'POST', body }),
  logout:      ()     => request('/api/auth/logout',   { method: 'POST' }),
  me:          ()     => request('/api/auth/me'),

  // Quiz
  questions:   ()             => request('/api/quiz/questions'),
  start:       ()             => request('/api/quiz/start', { method: 'POST' }),
  state:       ()             => request('/api/quiz/state'),
  quizStatus:  ()             => request('/api/quiz/status'),
  saveAnswer:  (body)         => request('/api/quiz/answer', { method: 'POST', body }),
  submit:      (body)         => request('/api/quiz/submit', { method: 'POST', body }),

  // Admin
  adminDashboard:    ()        => request('/api/admin/dashboard'),
  adminRanking:      ()        => request('/api/admin/ranking'),
  adminParticipants: ()        => request('/api/admin/participants'),
  adminQuestions:    ()        => request('/api/admin/questions'),
  adminCreateQ:      (body)    => request('/api/admin/questions', { method: 'POST', body }),
  adminUpdateQ:      (id,body) => request(`/api/admin/questions/${id}`, { method: 'PUT', body }),
  adminDeleteQ:      (id)      => request(`/api/admin/questions/${id}`, { method: 'DELETE' }),
  adminQuizStatus:   ()        => request('/api/admin/status'),
  adminSetStatus:    (status)  => request('/api/admin/status', { method: 'POST', body: { status } }),
  adminAttempt:      (id)      => request(`/api/admin/attempts/${id}`),
};
