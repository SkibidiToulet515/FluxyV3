import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { createUserDoc, getUserDoc, updateUserDoc, subscribeUser, getUserByUsername } from '../services/firestore';

const AuthContext = createContext(null);

const ROLES = { user: 0, mod: 1, admin: 2 };
const SYNTHETIC_DOMAIN = '@fluxy.local';

function toSyntheticEmail(username) {
  return username.toLowerCase().replace(/[^a-z0-9]/g, '') + SYNTHETIC_DOMAIN;
}

function isSyntheticEmail(email) {
  return email?.endsWith(SYNTHETIC_DOMAIN);
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
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
      const userDoc = await getUserByUsername(email);
      if (userDoc?.email) {
        email = userDoc.email;
      } else {
        email = toSyntheticEmail(email);
      }
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

  function hasRole(minRole) {
    if (!profile) return false;
    return (ROLES[profile.role] ?? 0) >= (ROLES[minRole] ?? 0);
  }

  const displayEmail = profile?.email && !isSyntheticEmail(profile.email) ? profile.email : null;

  const value = {
    user: firebaseUser,
    profile,
    loading,
    register,
    login,
    logout,
    setStatus,
    updateAvatar,
    updateBio,
    hasRole,
    isAdmin: profile?.role === 'admin',
    isMod: profile?.role === 'mod' || profile?.role === 'admin',

    account: profile ? {
      username: profile.username,
      email: displayEmail,
      color: pickColor(profile.username),
      status: profile.status || 'online',
      role: profile.role || 'user',
      avatar: profile.avatar || null,
      bio: profile.bio || '',
      uid: profile.uid,
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
