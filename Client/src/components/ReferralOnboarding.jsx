import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, Search, Loader2, Sparkles } from 'lucide-react';
import { apiJson } from '../services/apiClient';
import './ReferralOnboarding.css';

const MAX_REFERRALS = 2;
const LIST_LIMIT = 60;
const SEARCH_DEBOUNCE_MS = 280;

/**
 * Full-screen referral capture. Shown when `account.needsReferralOnboarding` (new signups).
 * Uses GET /api/users (search) and POST /api/referral.
 */
export default function ReferralOnboarding() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [foundMyself, setFoundMyself] = useState(false);
  const [limitHint, setLimitHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);
  const limitTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const loadUsers = useCallback(async (q) => {
    setLoadingList(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: String(LIST_LIMIT) });
      if (q) qs.set('q', q);
      const data = await apiJson(`/api/users?${qs.toString()}`);
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      setError(e.message || 'Could not load users');
      setUsers([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadUsers(debouncedSearch);
  }, [debouncedSearch, loadUsers]);

  const selectedArr = useMemo(() => [...selected], [selected]);

  function flashLimitMessage() {
    setLimitHint(true);
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    limitTimerRef.current = setTimeout(() => setLimitHint(false), 2200);
  }

  function toggleUser(uid) {
    if (foundMyself) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
        return next;
      }
      if (next.size >= MAX_REFERRALS) {
        flashLimitMessage();
        return prev;
      }
      next.add(uid);
      return next;
    });
  }

  function handleFoundMyself(checked) {
    setFoundMyself(checked);
    if (checked) {
      setSelected(new Set());
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!foundMyself && selected.size < 1) {
      setError('Pick up to 2 people who told you about Fluxy, or check “I found this site myself”.');
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/api/referral', {
        method: 'POST',
        body: {
          foundMyself,
          referrals: foundMyself ? [] : selectedArr,
        },
      });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = foundMyself || (selected.size >= 1 && selected.size <= MAX_REFERRALS);

  return (
    <div className="referral-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="referral-onboarding-title">
      <div className="referral-onboarding-backdrop" />
      <div className="referral-onboarding-card glass-card">
        <div className="referral-onboarding-icon">
          <Sparkles size={22} strokeWidth={1.75} />
        </div>
        <h2 id="referral-onboarding-title" className="referral-onboarding-title">
          Who told you about this site?
        </h2>
        <p className="referral-onboarding-sub">
          Choose up to two people from the community. This helps us grow Fluxy.
        </p>

        <form onSubmit={handleSubmit} className="referral-onboarding-form">
          <label className="referral-onboarding-self">
            <input
              type="checkbox"
              checked={foundMyself}
              onChange={(e) => handleFoundMyself(e.target.checked)}
            />
            <span>I found this site myself</span>
          </label>

          <div className={`referral-onboarding-search-wrap ${foundMyself ? 'is-disabled' : ''}`}>
            <Search size={16} className="referral-onboarding-search-icon" aria-hidden />
            <input
              type="search"
              className="referral-onboarding-search"
              placeholder="Search usernames…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={foundMyself}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {limitHint && (
            <p className="referral-onboarding-limit-msg" role="status">
              You can only choose up to 2 people
            </p>
          )}

          <div className={`referral-onboarding-list-wrap ${foundMyself ? 'is-disabled' : ''}`}>
            <div className="referral-onboarding-list-header">
              <Users size={14} />
              <span>Members</span>
              {selected.size > 0 && (
                <span className="referral-onboarding-picked">
                  {selected.size}/{MAX_REFERRALS} selected
                </span>
              )}
            </div>
            <ul className="referral-onboarding-list">
              {loadingList && (
                <li className="referral-onboarding-loading">
                  <Loader2 size={18} className="spin" aria-hidden />
                  Loading…
                </li>
              )}
              {!loadingList &&
                users.map((u) => {
                  const isOn = selected.has(u.uid);
                  const atCap = selected.size >= MAX_REFERRALS && !isOn;
                  return (
                    <li key={u.uid}>
                      <label
                        className={`referral-onboarding-row ${isOn ? 'is-selected' : ''} ${atCap && !foundMyself ? 'is-capped' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isOn}
                          disabled={foundMyself || atCap}
                          onChange={() => toggleUser(u.uid)}
                        />
                        <span className="referral-onboarding-name">{u.username}</span>
                      </label>
                    </li>
                  );
                })}
              {!loadingList && users.length === 0 && !error && (
                <li className="referral-onboarding-empty">No users match your search.</li>
              )}
            </ul>
          </div>

          {error && <p className="referral-onboarding-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary referral-onboarding-submit"
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" />
                Saving…
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
