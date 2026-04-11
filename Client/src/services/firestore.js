import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
  collection, query, where, orderBy, limit, startAfter, limitToLast,
  getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  addDoc, Timestamp, writeBatch, increment,
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

export async function searchUsers(searchTerm, maxResults = 20) {
  const lower = searchTerm.toLowerCase();
  const q = query(
    collection(db, 'users'),
    where('usernameLower', '>=', lower),
    where('usernameLower', '<=', lower + '\uf8ff'),
    limit(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
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

function friendDocId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function sendFriendRequest(fromUid, toUid) {
  if (fromUid === toUid) throw new Error('Cannot friend yourself');
  const id = friendDocId(fromUid, toUid);
  const ref = doc(db, 'friends', id);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    if (data.status === 'accepted') throw new Error('Already friends');
    if (data.status === 'pending') throw new Error('Request already pending');
  }
  await setDoc(ref, {
    users: [fromUid, toUid],
    status: 'pending',
    from: fromUid,
    to: toUid,
    createdAt: serverTimestamp(),
  });
}

export async function acceptFriendRequest(docId) {
  await updateDoc(doc(db, 'friends', docId), {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
  });
}

export async function declineFriendRequest(docId) {
  await deleteDoc(doc(db, 'friends', docId));
}

export async function cancelFriendRequest(docId) {
  await deleteDoc(doc(db, 'friends', docId));
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
    await setDoc(ref, {
      participants: [uid1, uid2],
      lastMessage: null,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
  return id;
}

export function subscribeDmChannels(uid, callback) {
  const q = query(
    collection(db, 'directMessages'),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeDmMessages(channelId, callback, messageLimit = 50) {
  const q = query(
    collection(db, 'directMessages', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(msgs.reverse());
  });
}

export async function loadOlderDmMessages(channelId, beforeDoc, count = 30) {
  const q = query(
    collection(db, 'directMessages', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(beforeDoc),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
}

export async function sendDmMessage(channelId, msg) {
  const messageData = {
    ...msg,
    senderUid: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  };
  const msgRef = await addDoc(
    collection(db, 'directMessages', channelId, 'messages'),
    messageData,
  );
  await updateDoc(doc(db, 'directMessages', channelId), {
    lastMessage: msg.text || (msg.gif ? 'GIF' : (msg.attachment ? 'File' : '')),
    lastMessageAt: serverTimestamp(),
    lastSenderUid: auth.currentUser.uid,
  });
  return msgRef.id;
}

// ─── Group Chats ──────────────────────────────────────────────────────────────

export async function createGroupChat(data) {
  const uid = auth.currentUser.uid;
  const ref = await addDoc(collection(db, 'groupChats'), {
    name: data.name,
    icon: data.icon || null,
    owner: uid,
    members: [uid, ...(data.members || [])],
    lastMessage: null,
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeGroupChats(uid, callback) {
  const q = query(
    collection(db, 'groupChats'),
    where('members', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updateGroupChat(groupId, fields) {
  await updateDoc(doc(db, 'groupChats', groupId), fields);
}

export async function addGroupMember(groupId, uid) {
  await updateDoc(doc(db, 'groupChats', groupId), {
    members: arrayUnion(uid),
  });
}

export async function removeGroupMember(groupId, uid) {
  await updateDoc(doc(db, 'groupChats', groupId), {
    members: arrayRemove(uid),
  });
}

export async function leaveGroupChat(groupId, uid) {
  await removeGroupMember(groupId, uid);
}

export function subscribeGroupMessages(groupId, callback, messageLimit = 50) {
  const q = query(
    collection(db, 'groupChats', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(msgs.reverse());
  });
}

export async function loadOlderGroupMessages(groupId, beforeDoc, count = 30) {
  const q = query(
    collection(db, 'groupChats', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(beforeDoc),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
}

export async function sendGroupMessage(groupId, msg) {
  const messageData = {
    ...msg,
    senderUid: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  };
  const msgRef = await addDoc(
    collection(db, 'groupChats', groupId, 'messages'),
    messageData,
  );
  await updateDoc(doc(db, 'groupChats', groupId), {
    lastMessage: msg.text || (msg.gif ? 'GIF' : (msg.attachment ? 'File' : '')),
    lastMessageAt: serverTimestamp(),
    lastSenderUid: auth.currentUser.uid,
  });
  return msgRef.id;
}

// ─── Servers ──────────────────────────────────────────────────────────────────

export async function createServer(data) {
  const uid = auth.currentUser.uid;
  const ref = await addDoc(collection(db, 'servers'), {
    name: data.name,
    icon: data.icon || null,
    owner: uid,
    members: [uid],
    channels: [{ id: 'general', name: 'General' }],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeServers(uid, callback) {
  const q = query(
    collection(db, 'servers'),
    where('members', 'array-contains', uid),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updateServer(serverId, fields) {
  await updateDoc(doc(db, 'servers', serverId), fields);
}

export async function joinServer(serverId, uid) {
  await updateDoc(doc(db, 'servers', serverId), {
    members: arrayUnion(uid),
  });
}

export async function leaveServer(serverId, uid) {
  await updateDoc(doc(db, 'servers', serverId), {
    members: arrayRemove(uid),
  });
}

export async function addServerChannel(serverId, channel) {
  await updateDoc(doc(db, 'servers', serverId), {
    channels: arrayUnion(channel),
  });
}

export function subscribeServerMessages(serverId, channelId, callback, messageLimit = 50) {
  const q = query(
    collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(msgs.reverse());
  });
}

export async function loadOlderServerMessages(serverId, channelId, beforeDoc, count = 30) {
  const q = query(
    collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(beforeDoc),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
}

export async function sendServerMessage(serverId, channelId, msg) {
  const messageData = {
    ...msg,
    senderUid: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  };
  await addDoc(
    collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
    messageData,
  );
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
