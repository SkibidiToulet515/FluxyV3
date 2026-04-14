import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  RotateCw,
  X,
} from 'lucide-react';
import { STANDALONE_META_EVENT } from '../standalone/constants';
import type { StandaloneMetaDetail } from '../hooks/useStandalonePageTitle';
import './StandaloneToolbar.css';

export interface StandaloneToolbarProps {
  bodyRef: RefObject<HTMLDivElement | null>;
}

export default function StandaloneToolbar({ bodyRef }: StandaloneToolbarProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Fluxy');
  const [fs, setFs] = useState(false);
  const [fsAvailable, setFsAvailable] = useState(
    typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen),
  );

  useEffect(() => {
    function onMeta(e: Event) {
      const ce = e as CustomEvent<StandaloneMetaDetail>;
      if (ce.detail?.title) setTitle(ce.detail.title);
    }
    window.addEventListener(STANDALONE_META_EVENT, onMeta);
    return () => window.removeEventListener(STANDALONE_META_EVENT, onMeta);
  }, []);

  useEffect(() => {
    function onFs() {
      setFs(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const close = useCallback(() => {
    window.close();
    setTimeout(() => {
      navigate('/');
    }, 200);
  }, [navigate]);

  const toggleFs = useCallback(() => {
    const el = bodyRef.current ?? document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        setFsAvailable(false);
      });
    } else {
      setFsAvailable(false);
    }
  }, [bodyRef]);

  return (
    <header className="standalone-toolbar glass-bg" role="banner">
      <div className="standalone-toolbar__actions">
        <button type="button" className="btn btn-ghost standalone-toolbar__btn" onClick={goBack} title="Back">
          <ArrowLeft size={18} />
        </button>
        <button type="button" className="btn btn-ghost standalone-toolbar__btn" onClick={reload} title="Reload">
          <RotateCw size={18} />
        </button>
        {fsAvailable && (
          <button
            type="button"
            className="btn btn-ghost standalone-toolbar__btn"
            onClick={toggleFs}
            title={fs ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fs ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}
        <button type="button" className="btn btn-ghost standalone-toolbar__btn" onClick={close} title="Close window">
          <X size={18} />
        </button>
      </div>
      <h1 className="standalone-toolbar__title">{title}</h1>
      <div className="standalone-toolbar__spacer" aria-hidden />
    </header>
  );
}
