import { useState, useRef, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Search, ArrowLeft, RotateCw, Home as HomeIcon,
  ExternalLink, Zap, Shield, Loader2, AlertTriangle,
} from 'lucide-react';
import {
  getActiveProvider,
  getActiveProviderId,
  checkProviderHealth,
} from '../services/providers';
import Header from '../components/Header';
import OpenInWindowButton from '../components/OpenInWindowButton';
import { useWindowMode } from '../hooks/useWindowMode';
import { useStandalonePageTitle } from '../hooks/useStandalonePageTitle';
import { toolStandalonePath } from '../standalone/paths';
import './Proxy.css';

const PROVIDER_ICONS = { Zap, Shield };

async function loadBareMux() {
  if (globalThis.BareMux?.BareMuxConnection) return globalThis.BareMux.BareMuxConnection;

  const res = await fetch('/baremux/index.js');
  if (!res.ok) throw new Error(`Failed to fetch bare-mux: ${res.status}`);
  const code = await res.text();

  /* Evaluate UMD bundle so `this` in the IIFE resolves to `window`,
     which lets the UMD path set globalThis.BareMux correctly. */
  const fn = new Function(code);
  fn.call(window);

  if (!globalThis.BareMux?.BareMuxConnection) {
    throw new Error(
      'bare-mux loaded but BareMuxConnection not on global. ' +
      `Keys: ${Object.keys(globalThis.BareMux || {}).join(', ') || 'none'}`
    );
  }
  return globalThis.BareMux.BareMuxConnection;
}

let swState = { ready: false, error: null, engines: null };

function pingSW(sw, timeout = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeout);
    navigator.serviceWorker.addEventListener('message', function handler(e) {
      if (e.data?.type === 'fluxy-pong') {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(e.data);
      }
    });
    sw.postMessage('fluxy-ping');
  });
}

async function ensureServiceWorker() {
  if (swState.ready) return swState;
  if (!('serviceWorker' in navigator)) {
    swState.error = 'Service workers are not supported in this browser.';
    return swState;
  }

  try {
    /* Unregister stale workers first so we always get the latest sw.js */
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    /* Wait for the new SW to activate */
    const sw = reg.installing || reg.waiting || reg.active;
    if (sw && sw.state !== 'activated') {
      await new Promise((resolve) => {
        sw.addEventListener('statechange', function onChange() {
          if (sw.state === 'activated' || sw.state === 'redundant') {
            sw.removeEventListener('statechange', onChange);
            resolve();
          }
        });
      });
    }

    await navigator.serviceWorker.ready;

    /* Ping the SW to see which engines loaded successfully */
    const active = reg.active || (await navigator.serviceWorker.ready).active;
    const pong = await pingSW(active);
    swState.engines = pong;

    /* Wire up bare-mux transport → epoxy → wisp server */
    const BMC = await loadBareMux();
    const conn = new BMC('/baremux/worker.js');
    await conn.setTransport('/epoxy/index.mjs', [
      { wisp: `${location.origin}/wisp/` },
    ]);

    swState.ready = true;
    return swState;
  } catch (err) {
    console.error('[Fluxy] SW init error:', err);
    swState.error = err?.message || 'Service worker registration failed.';
    return swState;
  }
}

export default function Proxy() {
  const outlet = useOutletContext();
  const onMenuToggle = outlet?.onMenuToggle ?? (() => {});
  const isWindow = useWindowMode();
  useStandalonePageTitle('Proxy', isWindow);
  const [provider, setProvider] = useState(getActiveProvider);
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(true);
  const [swReady, setSwReady] = useState(swState.ready);
  const [swError, setSwError] = useState(swState.error);
  const [query, setQuery] = useState('');
  const [frameUrl, setFrameUrl] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const iframeRef = useRef(null);

  /* Health check */
  const runHealthCheck = useCallback(async () => {
    setChecking(true);
    const result = await checkProviderHealth(provider.id);
    setHealth(result);
    setChecking(false);
  }, [provider.id]);

  useEffect(() => { runHealthCheck(); }, [runHealthCheck]);

  /* Register service worker on mount */
  useEffect(() => {
    let cancelled = false;
    ensureServiceWorker().then((state) => {
      if (cancelled) return;
      setSwReady(state.ready);
      if (state.error) setSwError(state.error);
    });
    return () => { cancelled = true; };
  }, []);

  /* Listen for provider changes from Settings */
  useEffect(() => {
    function onProviderChange() {
      const next = getActiveProvider();
      setProvider(next);
      setBrowsing(false);
      setFrameUrl('');
      setQuery('');
    }
    window.addEventListener('fluxy-provider-change', onProviderChange);
    return () => window.removeEventListener('fluxy-provider-change', onProviderChange);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const encoded = provider.adapter.encode(q);
    setFrameUrl(encoded);
    setBrowsing(true);
  }

  function goHome() {
    const encoded = provider.adapter.encode('https://duckduckgo.com');
    setFrameUrl(encoded);
  }

  function reload() {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src; // eslint-disable-line no-self-assign
    }
  }

  function exitBrowsing() {
    setBrowsing(false);
    setFrameUrl('');
    setQuery('');
  }

  const ProviderIcon = PROVIDER_ICONS[provider.icon] ?? Zap;
  const isAvailable = health?.available === true;

  /* ---------- Landing ---------- */
  if (!browsing) {
    return (
      <div className="proxy-page animate-fade-in">
        {!isWindow && <Header title="Proxy" onMenuClick={onMenuToggle} />}
        {!isWindow && (
          <div className="proxy-standalone-launch glass-bg">
            <OpenInWindowButton path={toolStandalonePath('proxy')} label="Open proxy in separate window" />
          </div>
        )}

        <div className="proxy-landing">
          <div className="proxy-landing-card glass-card">
            <div className="proxy-provider-badge">
              <ProviderIcon size={16} />
              <span>{provider.name}</span>
              {!checking && (
                <span className={`proxy-status-dot ${isAvailable ? 'online' : 'offline'}`} />
              )}
            </div>

            <h2>Private Browsing</h2>
            <p>Browse the web through Fluxy. Switch engines in Settings.</p>

            {checking ? (
              <div className="proxy-checking">
                <Loader2 size={20} className="spin" />
                <span>Checking provider...</span>
              </div>
            ) : swError ? (
              <div className="proxy-unavailable">
                <AlertTriangle size={18} />
                <div>
                  <strong>Service worker error</strong>
                  <p>{swError}</p>
                </div>
              </div>
            ) : !isAvailable ? (
              <div className="proxy-unavailable">
                <AlertTriangle size={18} />
                <div>
                  <strong>{provider.name} is unavailable</strong>
                  <p>{health?.message || 'Provider could not be reached.'}</p>
                </div>
              </div>
            ) : (
              <>
                {!swReady && (
                  <div className="proxy-checking">
                    <Loader2 size={18} className="spin" />
                    <span>Initializing proxy engine...</span>
                  </div>
                )}
                <form onSubmit={handleSearch} className="proxy-search-form">
                  <div className="proxy-search-wrap">
                    <Search size={16} className="proxy-search-icon" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search or enter URL..."
                      autoFocus
                      disabled={!swReady}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={!swReady}>
                    Browse
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Browsing ---------- */
  return (
    <div className="proxy-page proxy-active animate-fade-in">
      <div className="proxy-toolbar glass-bg">
        <div className="proxy-toolbar-nav">
          <button className="proxy-nav-btn" onClick={exitBrowsing} title="Back">
            <ArrowLeft size={16} />
          </button>
          <button className="proxy-nav-btn" onClick={goHome} title="Home">
            <HomeIcon size={16} />
          </button>
          <button className="proxy-nav-btn" onClick={reload} title="Reload">
            <RotateCw size={16} />
          </button>
        </div>

        <form onSubmit={handleSearch} className="proxy-toolbar-search">
          <Search size={14} className="proxy-toolbar-search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or URL..."
          />
        </form>

        <div className="proxy-toolbar-actions">
          {!isWindow && (
            <OpenInWindowButton path={toolStandalonePath('proxy')} iconOnly label="Open proxy in separate window" />
          )}
          <div className="proxy-toolbar-provider">
            <ProviderIcon size={13} />
            <span>{provider.name}</span>
          </div>
          {frameUrl && (
            <a
              href={frameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="proxy-nav-btn"
              title="Open in new tab"
            >
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>

      <div className="proxy-frame-container">
        <iframe
          ref={iframeRef}
          src={frameUrl}
          className="proxy-iframe"
          title="Web Tools"
          referrerPolicy="no-referrer"
          allowFullScreen
        />
      </div>
    </div>
  );
}
