import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Background from './components/Background';
import CustomCursor from './components/CustomCursor';
import LoadingScreen from './components/LoadingScreen';
import Home from './pages/Home';
import SubjectPage from './pages/SubjectPage';
import Proxy from './pages/Proxy';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import GamePlayer from './pages/GamePlayer';
import GeminiPanel from './pages/GeminiPanel';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import ModeratorPanel from './pages/ModeratorPanel';
import { useAuth } from './utils/AuthContext';
import useClickEffect from './utils/useClickEffect';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  useClickEffect(true);

  const cursorEnabled = typeof localStorage !== 'undefined'
    ? localStorage.getItem('fluxy-custom-cursor') !== 'false'
    : true;

  return (
    <>
      <Background />
      <CustomCursor enabled={cursorEnabled} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/games" element={<Navigate to="/math" replace />} />
          <Route path="/history" element={<Proxy />} />
          <Route path="/proxy" element={<Navigate to="/history" replace />} />
          <Route path="/math" element={<SubjectPage />} />
          <Route path="/assistant" element={<GeminiPanel />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/moderator" element={<ModeratorPanel />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>
        <Route path="/play/:gameId" element={<GamePlayer />} />
      </Routes>
    </>
  );
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const handleDone = useCallback(() => setLoaded(true), []);

  return (
    <>
      {!loaded && <LoadingScreen onDone={handleDone} />}
      <AppShell />
    </>
  );
}
