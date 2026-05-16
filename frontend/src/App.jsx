import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './api/auth.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Quiz from './pages/Quiz.jsx';
import Admin from './pages/Admin.jsx';
import Podium from './pages/Podium.jsx';

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-20">…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  // La page podium est plein écran (pour projection)
  // → on retire le Layout (header + footer)
  const fullscreen = location.pathname === '/admin/podium';

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/quiz"
        element={<Protected role="user"><Quiz /></Protected>}
      />
      <Route
        path="/admin"
        element={<Protected role="admin"><Admin /></Protected>}
      />
      <Route
        path="/admin/podium"
        element={<Protected role="admin"><Podium /></Protected>}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return fullscreen ? routes : <Layout>{routes}</Layout>;
}
