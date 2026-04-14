import { useLayoutEffect, useRef } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { STANDALONE_MODE_PARAM, STANDALONE_MODE_VALUE } from '../standalone/constants';
import StandaloneToolbar from './StandaloneToolbar';
import './WindowModeGate.css';

/**
 * Root gate: when `?mode=window`, renders compact chrome + outlet; otherwise outlet only.
 * Refresh-safe: query is part of the URL.
 */
export default function WindowModeGate() {
  const [params] = useSearchParams();
  const isWindow = params.get(STANDALONE_MODE_PARAM) === STANDALONE_MODE_VALUE;
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isWindow) return;
    document.documentElement.classList.add('fluxy-standalone-window');
    return () => {
      document.documentElement.classList.remove('fluxy-standalone-window');
    };
  }, [isWindow]);

  if (!isWindow) {
    return <Outlet />;
  }

  return (
    <div className="window-mode-root">
      <StandaloneToolbar bodyRef={bodyRef} />
      <div ref={bodyRef} className="window-mode-body">
        <Outlet />
      </div>
    </div>
  );
}
