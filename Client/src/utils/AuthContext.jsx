import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { createUserDoc, getUserDoc, updateUserDoc, subscribeUser } from '../services/firestore';
import { expandLegacyManageRoles } from '../lib/rbacClient';

const AuthContext = createContext(null);

/** Legacy tier compare when roleDefinitions doc is missing (treat as pre-migration). */
const ROLES = { user: 0, mod: 1, admin: 2 };
const SYNTHETIC_DOMAIN = '@fluxy.local';

function toSyntheticEmail(username) {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '') + SYNTHETIC_DOMAIN;
}

function isSyntheticEmail(email) {
  return email?.endsWith(SYNTHETIC_DOMAIN);
}

async function resolveUsernameToEmail(username) {
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (!base) return { email: null, noApiUrl: true };
  try {
    const res = await fetch(`${base}/api/auth/resolve-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) return { email: null, notFound: true };
    if (res.status === 503 || res.status >= 500) return { email: null, serverDown: true };
    if (!res.ok) return { email: null, serverDown: true };
    if (data.found && data.email) return { email: data.email };
    return { email: null, notFound: true };
  } catch {
    return { email: null, networkError: true };
  }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [roleDefinition, setRoleDefinition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user ?? null);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeUser(firebaseUser.uid, (doc) => {
      if (doc) setProfile(doc);
      setLoading(false);
    });
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !profile?.role) {
      setRoleDefinition(null);
      return;
    }
    const roleKey = profile.role;
    const unsub = onSnapshot(
      doc(db, 'roleDefinitions', roleKey),
      (snap) => {
        setRoleDefinition(snap.exists() ? { key: roleKey, ...snap.data() } : null);
      },
      () => setRoleDefinition(null),
    );
    return unsub;
  }, [firebaseUser, profile?.role]);

  const register = useCallback(async (username, password, email) => {
    const effectiveEmail = email?.trim() || toSyntheticEmail(username);
    const cred = await createUserWithEmailAndPassword(auth, effectiveEmail, password);
    await updateProfile(cred.user, { displayName: username });
    await createUserDoc(cred.user.uid, { username, email: effectiveEmail });
    return cred.user;
  }, []);

  const login = useCallback(async (identifier, password) => {
    let email = identifier.trim();

    if (!email.includes('@')) {
      const rawUser = email;
      const r = await resolveUsernameToEmail(rawUser);
      if (r.serverDown || r.networkError) {
        throw new Error(
          'Login service could not look up your username (server misconfigured). Sign in with your email instead — for Fluxinator use admin@fluxyv3.online.',
        );
      }
      if (r.noApiUrl) {
        throw new Error('App is missing API configuration. Contact the site owner.');
      }
      email = r.email || toSyntheticEmail(rawUser);
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getUserDoc(cred.user.uid);
    if (userDoc?.banned) {
      await signOut(auth);
      throw new Error('This account has been banned.');
    }
    await updateUserDoc(cred.user.uid, { status: 'online' });
    return cred.user;
  }, []);

  const logout = useCallback(async () => {
    if (firebaseUser) {
      try { await updateUserDoc(firebaseUser.uid, { status: 'offline' }); } catch { /* noop */ }
    }
    await signOut(auth);
  }, [firebaseUser]);

  const setStatus = useCallback(async (status) => {
    if (!firebaseUser) return;
    await updateUserDoc(firebaseUser.uid, { status });
  }, [firebaseUser]);

  const updateAvatar = useCallback(async (url) => {
    if (!firebaseUser) return;
    await updateUserDoc(firebaseUser.uid, { avatar: url });
    await updateProfile(firebaseUser, { photoURL: url });
  }, [firebaseUser]);

  const updateBio = useCallback(async (bio) => {
    if (!firebaseUser) return;
    await updateUserDoc(firebaseUser.uid, { bio });
  }, [firebaseUser]);

  const eff = useMemo(
    () => expandLegacyManageRoles(roleDefinition?.permissions || {}),
    [roleDefinition],
  );

  const hasPermission = useCallback((perm) => Boolean(eff[perm]), [eff]);

  function hasRole(minRole) {
    if (!profile) return false;
    if (roleDefinition?.permissions) {
      if (minRole === 'admin') return hasPermission('access_admin_panel');
      if (minRole === 'mod') {
        return hasPermission('access_moderator_panel') || hasPermission('access_admin_panel');
      }
    }
    return (ROLES[profile.role] ?? 0) >= (ROLES[minRole] ?? 0);
  }
  const isAdmin = Boolean(
    eff.access_admin_panel
    || (!roleDefinition && profile?.role === 'admin'),
  );
  const isMod = Boolean(
    eff.access_moderator_panel
    || eff.access_admin_panel
    || (!roleDefinition && (profile?.role === 'mod' || profile?.role === 'admin')),
  );

  const displayEmail = profile?.email && !isSyntheticEmail(profile.email) ? profile.email : null;

  const value = {
    user: firebaseUser,
    profile,
    roleDefinition,
    loading,
    register,
    login,
    logout,
    setStatus,
    updateAvatar,
    updateBio,
    hasRole,
    hasPermission,
    isAdmin,
    isMod,

    account: profile ? {
      username: profile.username,
      email: displayEmail,
      color: pickColor(profile.username),
      status: profile.status || 'online',
      role: profile.role || 'user',
      roleDisplayName: roleDefinition?.displayName || profile.role || 'user',
      avatar: profile.avatar || null,
      bio: profile.bio || '',
      uid: profile.uid,
      mutedUntil: profile.mutedUntil || null,
      chatRestricted: profile.chatRestricted === true,
    } : null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#22d3ee', '#34d399', '#f97316', '#a855f7', '#38bdf8',
];

function pickColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
