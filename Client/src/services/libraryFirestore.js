import {
  doc, setDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, addDoc, getDoc,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export function libraryItemKey(kind, id) {
  return `${kind}_${String(id).replace(/[/]/g, '_')}`;
}

export async function setFavorite(kind, refId, meta = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  const key = libraryItemKey(kind, refId);
  await setDoc(doc(db, 'users', uid, 'favorites', key), {
    kind,
    refId: String(refId),
    title: meta.title || '',
    category: meta.category || '',
    thumb: meta.thumb || null,
    createdAt: serverTimestamp(),
  });
}

export async function removeFavorite(kind, refId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  const key = libraryItemKey(kind, refId);
  await deleteDoc(doc(db, 'users', uid, 'favorites', key));
}

export async function isFavorite(kind, refId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  const snap = await getDoc(doc(db, 'users', uid, 'favorites', libraryItemKey(kind, refId)));
  return snap.exists();
}

export function subscribeFavorites(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'users', uid, 'favorites'), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    () => callback([]),
  );
}

export async function createCollection({ name, color = '#6366f1' }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  const ref = doc(collection(db, 'users', uid, 'collections'));
  await setDoc(ref, {
    name: String(name || 'Collection').slice(0, 60),
    color,
    orderIndex: Date.now(),
    items: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCollection(cid, data) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await setDoc(
    doc(db, 'users', uid, 'collections', cid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteCollection(cid) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await deleteDoc(doc(db, 'users', uid, 'collections', cid));
}

export function subscribeCollections(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'users', uid, 'collections'), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      callback(list);
    },
    () => callback([]),
  );
}

/** Add or move item in collection (replaces full items array — caller merges). */
export async function saveCollectionItems(cid, items) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await setDoc(
    doc(db, 'users', uid, 'collections', cid),
    { items: items.slice(0, 80), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function logActivity({ kind, refId, label, path }) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await addDoc(collection(db, 'users', uid, 'activityLog'), {
    kind,
    refId: String(refId || ''),
    label: String(label || '').slice(0, 120),
    path: path ? String(path).slice(0, 200) : null,
    at: serverTimestamp(),
  });
}

export function subscribeActivityLog(callback, n = 40) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'users', uid, 'activityLog'), orderBy('at', 'desc'), limit(n));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    () => callback([]),
  );
}
