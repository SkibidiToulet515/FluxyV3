import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  addDoc, Timestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { uploadGameFile, deleteGameFileByPath } from './storage';

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUserDoc(uid, data) {
  const uname = data.username || '';
  await setDoc(doc(db, 'users', uid), {
    username: uname,
    usernameLower: uname.toLowerCase(),
    email: data.email,
    role: 'user',
    status: 'online',
    avatar: data.avatar || null,
    bio: '',
    createdAt: serverTimestamp(),
  });
}

export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function getUserByUsername(username) {
  const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

export async function updateUserDoc(uid, fields) {
  await updateDoc(doc(db, 'users', uid), fields);
}

export function subscribeUser(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? { uid, ...snap.data() } : null);
  });
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export async function sendFriendRequest(fromUid, toUid) {
  const id = [fromUid, toUid].sort().join('_');
  await setDoc(doc(db, 'friends', id), {
    users: [fromUid, toUid],
    status: 'pending',
    from: fromUid,
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(docId) {
  await updateDoc(doc(db, 'friends', docId), { status: 'accepted' });
}

export async function removeFriend(docId) {
  await deleteDoc(doc(db, 'friends', docId));
}

export function subscribeFriends(uid, callback) {
  const q = query(
    collection(db, 'friends'),
    where('users', 'array-contains', uid),
    where('status', '==', 'accepted'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeFriendRequests(uid, callback) {
  const q = query(
    collection(db, 'friends'),
    where('users', 'array-contains', uid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// ─── Direct Messages ──────────────────────────────────────────────────────────

export function getDmChannelId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function ensureDmChannel(uid1, uid2) {
  const id = getDmChannelId(uid1, uid2);
  const ref = doc(db, 'directMessages', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { participants: [uid1, uid2], createdAt: serverTimestamp() });
  }
  return id;
}

export function subscribeDmMessages(channelId, callback, messageLimit = 100) {
  const q = query(
    collection(db, 'directMessages', channelId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendDmMessage(channelId, msg) {
  await addDoc(collection(db, 'directMessages', channelId, 'messages'), {
    ...msg,
    createdAt: serverTimestamp(),
  });
}

// ─── Servers (Group Chats) ────────────────────────────────────────────────────

export async function createServer(data) {
  const ref = await addDoc(collection(db, 'servers'), {
    name: data.name,
    icon: data.icon || null,
    owner: data.owner,
    members: [data.owner],
    channels: [{ id: 'general', name: 'General' }],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeServers(uid, callback) {
  const q = query(collection(db, 'servers'), where('members', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function joinServer(serverId, uid) {
  await updateDoc(doc(db, 'servers', serverId), { members: arrayUnion(uid) });
}

export async function leaveServer(serverId, uid) {
  await updateDoc(doc(db, 'servers', serverId), { members: arrayRemove(uid) });
}

export function subscribeServerMessages(serverId, channelId, callback, messageLimit = 150) {
  const q = query(
    collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendServerMessage(serverId, channelId, msg) {
  await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), {
    ...msg,
    createdAt: serverTimestamp(),
  });
}

// ─── Game Metadata ────────────────────────────────────────────────────────────

export async function saveGameMeta(gameId, data) {
  await setDoc(doc(db, 'games', gameId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getGameMeta(gameId) {
  const snap = await getDoc(doc(db, 'games', gameId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function incrementGamePlays(gameId) {
  const ref = doc(db, 'games', gameId);
  const snap = await getDoc(ref);
  const plays = snap.exists() ? (snap.data().plays || 0) + 1 : 1;
  await setDoc(ref, { plays, lastPlayed: serverTimestamp() }, { merge: true });
}

// ─── Admin: Users ─────────────────────────────────────────────────────────────

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export async function submitUserReport({ reason, targetUid = null, targetUsername = null }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await addDoc(collection(db, 'reports'), {
    reporterUid: uid,
    reason: (reason || '').toString().slice(0, 1000),
    targetUid: targetUid || null,
    targetUsername: targetUsername || null,
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

// ─── Admin: Games ─────────────────────────────────────────────────────────────

export async function getAllGameDocs() {
  const snap = await getDocs(collection(db, 'games'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createGameDoc(data, gameFile = null) {
  const gameRef = doc(collection(db, 'games'));
  const gameId = gameRef.id;
  let url = (data.url || '').trim();
  let storagePath = null;
  if (gameFile) {
    const uploaded = await uploadGameFile(gameId, gameFile);
    url = uploaded.url;
    storagePath = uploaded.path;
  }
  await setDoc(gameRef, {
    title: data.title,
    category: data.category || 'Uncategorized',
    description: data.description || '',
    thumbnail: data.thumbnail || null,
    url,
    ...(storagePath ? { storagePath } : {}),
    plays: 0,
    featured: data.featured || false,
    visible: data.visible !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return gameId;
}

export async function updateGameDoc(gameId, fields, gameFile = null) {
  const updates = { ...fields, updatedAt: serverTimestamp() };
  if (gameFile) {
    const meta = await getGameMeta(gameId);
    if (meta?.storagePath) {
      await deleteGameFileByPath(meta.storagePath);
    }
    const uploaded = await uploadGameFile(gameId, gameFile);
    updates.url = uploaded.url;
    updates.storagePath = uploaded.path;
  }
  await updateDoc(doc(db, 'games', gameId), updates);
}

export async function deleteGameDoc(gameId) {
  const meta = await getGameMeta(gameId);
  if (meta?.storagePath) {
    await deleteGameFileByPath(meta.storagePath);
  }
  await deleteDoc(doc(db, 'games', gameId));
}
