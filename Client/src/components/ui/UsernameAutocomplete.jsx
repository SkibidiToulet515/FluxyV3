import { useState, useEffect, useRef, useCallback } from 'react';
import { apiJson } from '../../services/apiClient';
import './UsernameAutocomplete.css';

/**
 * Admin-style username search → returns selected uid (internal).
 * Displays usernames only in the UI.
 */
export default function UsernameAutocomplete({
  value,
  onChange,
  onResolvedUid,
  placeholder = 'Search username…',
  id,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState([]);
  const [searchErr, setSearchErr] = useState('');
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) {
      setHits([]);
      setSearchErr('');
      return;
    }
    setLoading(true);
    setSearchErr('');
    try {
      let data;
      try {
        data = await apiJson(`/api/admin/users/search?q=${encodeURIComponent(t)}`);
      } catch (e) {
        /** Older API builds (404) or permission quirks: same prefix search via referral directory. */
        if (e?.status === 404 || e?.status === 403) {
          data = await apiJson(`/api/users?q=${encodeURIComponent(t)}&limit=24`);
        } else {
          throw e;
        }
      }
      let list = data.users || [];
      /** If admin route returned empty, try public user directory (prefix search). */
      if (list.length === 0) {
        try {
          const fb = await apiJson(`/api/users?q=${encodeURIComponent(t)}&limit=24`);
          list = fb.users || [];
        } catch {
          /* keep empty */
        }
      }
      setHits(list);
    } catch (e) {
      setHits([]);
      setSearchErr(e?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="username-ac-wrap" ref={wrapRef}>
      <input
        id={id}
        type="text"
        className="username-ac-input"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onResolvedUid?.(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && value.trim().length >= 2 ? (
        <ul className="username-ac-dropdown glass-card" role="listbox">
          {loading ? (
            <li className="username-ac-muted">Searching…</li>
          ) : searchErr ? (
            <li className="username-ac-muted username-ac-err">{searchErr}</li>
          ) : hits.length === 0 ? (
            <li className="username-ac-muted">No matches</li>
          ) : (
            hits.map((u) => (
              <li key={u.uid}>
                <button
                  type="button"
                  className="username-ac-hit"
                  onClick={() => {
                    onChange(u.username || '');
                    onResolvedUid?.(u.uid);
                    setOpen(false);
                  }}
                >
                  {u.username || u.uid}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
