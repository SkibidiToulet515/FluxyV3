import { useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Background from './components/Background';
import AuroraBackground from './components/AuroraBackground';
import FilmGrain from './components/FilmGrain';
import NeuralParticles from './components/NeuralParticles';
import ScrollProgressBar from './components/ScrollProgressBar';
import CustomCursor from './components/CustomCursor';
import LoadingScreen from './components/LoadingScreen';
import BannedGate from './components/BannedGate';
import Home from './pages/Home';
import SubjectPage from './pages/SubjectPage';
import Proxy from './pages/Proxy';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import GamePlayer from './pages/GamePlayer';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import ModeratorPanel from './pages/ModeratorPanel';
import GameDetailPage from './pages/GameDetailPage';
import LibraryPage from './pages/LibraryPage';
import ProfilePage from './pages/ProfilePage';
import ShopPage from './pages/ShopPage';
import InventoryPage from './pages/InventoryPage';
import WalletPage from './pages/WalletPage';
import AppealPage from './pages/AppealPage';
import ModerationAccountPage from './pages/ModerationAccountPage';
import ToolRouteHost from './pages/ToolRouteHost';
import { useAuth } from './utils/AuthContext';
import useGlobalClickEffects from './utils/useGlobalClickEffects';
import { getPerformanceProfile } from './utils/performanceProfile';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  useGlobalClickEffects(true);

  const perf = useMemo(() => getPerformanceProfile(), []);

  useLayoutEffect(() => {
    document.documentElement.dataset.fluxyPerf = perf.tier;
    return () => {
      delete document.documentElement.dataset.fluxyPerf;
    };
  }, [perf.tier]);

  const cursorEnabled =
    typeof localStorage !== 'undefined' ? localStorage.getItem('fluxy-custom-cursor') !== 'false' : true;

  return (
    <>
      <AuroraBackground variant={perf.aurora} />
      <Background mode={perf.backgroundMode} />
      {perf.filmGrain ? <FilmGrain /> : null}
      <NeuralParticles
        dotCount={perf.neuralDots}
        linkDistance={perf.neuralLinkDist}
        frameSkip={perf.neuralFrameSkip}
      />
      <ScrollProgressBar />
      <CustomCursor enabled={cursorEnabled} showGlow={perf.cursorGlow} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/appeal" element={<RequireAuth><AppealPage /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><BannedGate><Chat /></BannedGate></RequireAuth>} />
        <Route path="/games/:gameId" element={<GamePlayer />} />
        <Route path="/play/:gameId" element={<GamePlayer />} />
        <Route element={<RequireAuth><BannedGate><Layout /></BannedGate></RequireAuth>}>
          <Route path="/" element={<Home />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/game/:gameId" element={<GameDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/games" element={<SubjectPage />} />
          <Route path="/history" element={<Proxy />} />
          <Route path="/proxy" element={<Navigate to="/history" replace />} />
          <Route path="/math" element={<Navigate to="/games" replace />} />
          <Route path="/tools/:toolId" element={<ToolRouteHost />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/moderation" element={<ModerationAccountPage />} />
          <Route path="/moderator" element={<ModeratorPanel />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>
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
