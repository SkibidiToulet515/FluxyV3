import { createContext, useContext, useState, useEffect } from 'react';

const AccountContext = createContext(null);

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#22d3ee', '#34d399', '#f97316', '#a855f7', '#38bdf8',
];

function pickColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(() => {
    try {
      const raw = localStorage.getItem('fluxy-account');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (account) {
      localStorage.setItem('fluxy-account', JSON.stringify(account));
    } else {
      localStorage.removeItem('fluxy-account');
    }
  }, [account]);

  function register(username, password) {
    const accounts = getAccounts();
    if (accounts[username.toLowerCase()]) {
      return { ok: false, error: 'Username already taken' };
    }
    accounts[username.toLowerCase()] = { username, password, createdAt: Date.now() };
    localStorage.setItem('fluxy-accounts-db', JSON.stringify(accounts));
    const acc = {
      username,
      color: pickColor(username),
      status: 'online',
      joinedAt: Date.now(),
    };
    setAccount(acc);
    return { ok: true };
  }

  function login(username, password) {
    const accounts = getAccounts();
    const entry = accounts[username.toLowerCase()];
    if (!entry) return { ok: false, error: 'Account not found' };
    if (entry.password !== password) return { ok: false, error: 'Wrong password' };
    const acc = {
      username: entry.username,
      color: pickColor(entry.username),
      status: 'online',
      joinedAt: entry.createdAt,
    };
    setAccount(acc);
    return { ok: true };
  }

  function logout() {
    setAccount(null);
  }

  function setStatus(status) {
    setAccount(prev => prev ? { ...prev, status } : null);
  }

  function getAccounts() {
    try {
      return JSON.parse(localStorage.getItem('fluxy-accounts-db') || '{}');
    } catch {
      return {};
    }
  }

  return (
    <AccountContext.Provider value={{ account, register, login, logout, setStatus }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within AccountProvider');
  return ctx;
}
