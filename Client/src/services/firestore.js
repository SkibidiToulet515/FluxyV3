import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, startAfter,
  getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove,
  addDoc, increment, runTransaction,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { uploadGameFile, deleteGameFileByPath } from './storage';

/** Newest page size for realtime listeners; older pages use the same batch size. */
export const CHAT_PAGE_SIZE = 50;

if (typeof window !== 'undefined') {
  window.__diagnoseDMs = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { console.error('Not signed in'); return; }
    console.group('[DM Diagnosis]');
    console.log('Project:', db.app.options.projectId);
    console.log('UID:', uid);

    const friendsSnap = await getDocs(query(
      collection(db, 'friends'),
      where('users', 'array-contains', uid),
      where('status', '==', 'accepted'),
    ));
    const friends = friendsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log(`Friends: ${friends.length}`, friends.map((f) => f.id));

    for (const f of friends) {
      const other = f.users?.find((u) => u !== uid);
      if (!other) continue;
      const pair = [uid, other].sort();
      const dmId = pair.join('_');
      console.log(`--- Friend ${other} → DM path: directMessages/${dmId}`);

      try {
        await setDoc(doc(db, 'directMessages', dmId), {
          participants: pair,
          lastMessage: null,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        console.log(`  CREATE ✓ (new doc or overwrite succeeded)`);
      } catch (err) {
        console.log(`  CREATE result: ${err.code} — ${err.message}`);
      }
    }

    try {
      const dmSnap = await getDocs(query(
        collection(db, 'directMessages'),
        where('participants', 'array-contains', uid),
      ));
      console.log(`DMs found: ${dmSnap.size}`, dmSnap.docs.map((d) => d.id));
    } catch (err) {
      console.error(`DM query failed: ${err.code} — ${err.message}`);
    }
    console.groupEnd();
  };
}

export const DEFAULT_SERVER_ID = 'fluxy-community';
const DEFAULT_SERVER_CHANNELS = [
  { id: 'general', name: 'General' },
  { id: 'memes', name: 'Memes' },
];

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
    hasCompletedReferral: false,
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

export async function updateUserSettings(uid, fields) {
  await updateDoc(doc(db, 'users', uid), fields);
}

export async function getUserSettings(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : {};
}

export function subscribeUser(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? { uid, ...snap.data() } : null);
  });
}

// ─── Friends ──────────────────────────────────────────────────────────────────

/**
 * Create a pending friend request. Uses the signed-in user as sender (not the caller arg)
 * so Firestore rules always match `request.auth.uid == from`.
 *
 * Uses a transaction so legacy / malformed `friends/{uid_uid}` docs (anything other than
 * accepted or pending) are deleted first — otherwise `setDoc` would be an `update`, which
 * rules only allow for "accept", and would return permission-denied.
 */
export async function sendFriendRequest(_fromUid, toUid) {
  const fromUid = auth.currentUser?.uid;
  if (!fromUid) throw new Error('Sign in required');
  if (fromUid === toUid) throw new Error('Cannot friend yourself');

  const pair = [fromUid, toUid].slice().sort();
  const id = pair.join('_');
  const ref = doc(db, 'friends', id);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists()) {
        const data = snap.data();
        if (data.status === 'accepted') {
          throw new Error('Already friends');
        }
        if (data.status === 'pending') {
          throw new Error('Request already pending');
        }
        const users = Array.isArray(data.users) ? data.users : [];
        if (!users.includes(fromUid)) {
          throw new Error(
            'A friend record for this pair exists but cannot be updated. Contact support.',
          );
        }
        transaction.delete(ref);
      }
      transaction.set(ref, {
        users: pair,
        status: 'pending',
        from: fromUid,
        to: toUid,
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error(
        'Could not send friend request (permission denied). Deploy the latest firestore.rules to Firebase, confirm you are signed in, then try again.',
      );
    }
    throw err;
  }
}

/**
 * Accept a pending friend request and ensure the canonical DM thread exists for the pair.
 * DM id is always sorted UIDs joined by "_" (see getDmChannelId).
 */
export async function acceptFriendRequest(docId) {
  const ref = doc(db, 'friends', docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Friend request not found');
  const data = snap.data();
  if (data.status !== 'pending') throw new Error('Request is no longer pending');
  const users = data.users;
  if (!Array.isArray(users) || users.length !== 2) throw new Error('Invalid friend record');
  await updateDoc(ref, {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
  });
  await ensureDmChannel(users[0], users[1]);
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

function snapshotErrorHandler(label) {
  return (err) => console.error(`[Fluxy] ${label} listener error:`, err.code || err.message);
}

export function subscribeFriends(uid, callback) {
  const q = query(
    collection(db, 'friends'),
    where('users', 'array-contains', uid),
    where('status', '==', 'accepted'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, snapshotErrorHandler('subscribeFriends'));
}

export function subscribeFriendRequests(uid, callback) {
  const q = query(
    collection(db, 'friends'),
    where('users', 'array-contains', uid),
    where('status', '==', 'pending'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, snapshotErrorHandler('subscribeFriendRequests'));
}

// ─── Direct Messages ──────────────────────────────────────────────────────────
//
// Model: one document per pair at directMessages/{uidLo_uidHi}
// - uidLo/uidHi are the two Firebase auth UIDs sorted lexicographically (must match Firestore rules).
// - participants[] on the doc is the same two UIDs in that sorted order.
// This prevents duplicate threads for the same pair under alternate document ids.

const DM_ID_SEP = '_';

/** Sorted [uidLo, uidHi] — single source of truth for DM addressing (must match security rules). */
export function orderedDmPair(uid1, uid2) {
  return [uid1, uid2].slice().sort();
}

/** Canonical DM document id for a pair (no duplicate docs for the same two users). */
export function getDmChannelId(uid1, uid2) {
  return orderedDmPair(uid1, uid2).join(DM_ID_SEP);
}

/**
 * Create the DM thread doc if missing; idempotent.
 * Tries to create — if the doc already exists Firestore rules will deny the
 * overwrite (which is fine, the doc is already there).
 */
export async function ensureDmChannel(uid1, uid2) {
  if (!uid1 || !uid2 || uid1 === uid2) {
    throw new Error('Invalid direct message participants');
  }
  const pair = orderedDmPair(uid1, uid2);
  const id = pair.join(DM_ID_SEP);
  const ref = doc(db, 'directMessages', id);

  try {
    await setDoc(ref, {
      participants: pair,
      lastMessage: null,
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
    console.log(`[Fluxy] ensureDmChannel: created DM ${id}`);
  } catch (err) {
    if (err.code === 'permission-denied') {
      // Expected when doc already exists — the update rule rejects overwriting
      // non-allowed fields, which means the doc is already in place.
      console.log(`[Fluxy] ensureDmChannel: DM ${id} already exists`);
    } else {
      console.warn(`[Fluxy] ensureDmChannel error for ${id}:`, err.code, err.message);
    }
  }
  return id;
}

/**
 * Backfill: ensure every accepted friendship has a DM thread.
 * Reads all accepted friends for `uid`, computes deterministic DM IDs, batch-checks which
 * docs exist, and creates missing ones. Runs once on app load — idempotent and safe to
 * call concurrently (setDoc with deterministic ID is a no-op if the doc already exists).
 */
export async function backfillFriendDms(uid, friends) {
  if (!uid || !friends?.length) return;
  let count = 0;
  for (const f of friends) {
    const other = f.users?.find((u) => u !== uid);
    if (!other) continue;
    await ensureDmChannel(uid, other);
    count++;
  }
  console.log(`[Fluxy] backfillFriendDms: processed ${count} friend(s)`);
}

export function subscribeDmChannels(uid, callback) {
  const q = query(
    collection(db, 'directMessages'),
    where('participants', 'array-contains', uid),
  );
  return onSnapshot(q, (snap) => {
    const channels = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.lastMessageAt?.toMillis?.() ?? 0;
        const tb = b.lastMessageAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
    console.log(`[Fluxy] subscribeDmChannels: ${channels.length} DM(s) for ${uid.slice(0, 8)}…`);
    callback(channels);
  }, (err) => {
    console.error('[Fluxy] subscribeDmChannels ERROR:', err.code, err.message);
  });
}

/**
 * Realtime: newest `messageLimit` messages only (desc query, reversed to chronological).
 * meta.oldestLiveDoc: cursor for loadOlder* (chronologically oldest on this page).
 * meta.isFullPage: if true, older messages may exist before oldestLiveDoc.
 */
export function subscribeDmMessages(channelId, callback, messageLimit = CHAT_PAGE_SIZE) {
  console.log(`[Fluxy] subscribeDmMessages: listening on directMessages/${channelId}/messages`);
  const q = query(
    collection(db, 'directMessages', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs;
    const msgs = docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    const oldestLiveDoc = docs.length ? docs[docs.length - 1] : null;
    console.log(`[Fluxy] subscribeDmMessages: ${msgs.length} message(s) in ${channelId}`);
    callback(msgs, {
      oldestLiveDoc,
      isFullPage: docs.length === messageLimit,
    });
  }, (err) => {
    console.error(`[Fluxy] subscribeDmMessages ERROR on ${channelId}:`, err.code, err.message);
  });
}

/** Load older messages before `cursorDoc` (QueryDocumentSnapshot of current oldest loaded). */
export async function loadOlderDmMessages(channelId, cursorDoc, batchSize = CHAT_PAGE_SIZE) {
  if (!cursorDoc) return { messages: [], oldestDocSnap: null, fetchedCount: 0 };
  const q = query(
    collection(db, 'directMessages', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursorDoc),
    limit(batchSize),
  );
  const snap = await getDocs(q);
  if (snap.empty) return { messages: [], oldestDocSnap: null, fetchedCount: 0 };
  const docs = snap.docs;
  const messages = docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
  const oldestDocSnap = docs[docs.length - 1];
  return { messages, oldestDocSnap, fetchedCount: docs.length };
}

export async function sendDmMessage(channelId, msg) {
  console.log(`[Fluxy] sendDmMessage: writing to directMessages/${channelId}/messages`);
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
  console.log(`[Fluxy] sendDmMessage: saved message ${msgRef.id} in ${channelId}`);
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
  }, snapshotErrorHandler('subscribeGroupChats'));
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

export function subscribeGroupMessages(groupId, callback, messageLimit = CHAT_PAGE_SIZE) {
  const q = query(
    collection(db, 'groupChats', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs;
    const msgs = docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    const oldestLiveDoc = docs.length ? docs[docs.length - 1] : null;
    callback(msgs, {
      oldestLiveDoc,
      isFullPage: docs.length === messageLimit,
    });
  }, snapshotErrorHandler('subscribeGroupMessages'));
}

export async function loadOlderGroupMessages(groupId, cursorDoc, batchSize = CHAT_PAGE_SIZE) {
  if (!cursorDoc) return { messages: [], oldestDocSnap: null, fetchedCount: 0 };
  const q = query(
    collection(db, 'groupChats', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursorDoc),
    limit(batchSize),
  );
  const snap = await getDocs(q);
  if (snap.empty) return { messages: [], oldestDocSnap: null, fetchedCount: 0 };
  const docs = snap.docs;
  const messages = docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
  const oldestDocSnap = docs[docs.length - 1];
  return { messages, oldestDocSnap, fetchedCount: docs.length };
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
    // Document id must win — spread data last could overwrite `id` if a bad field exists in the doc.
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  }, snapshotErrorHandler('subscribeServers'));
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

export function subscribeServerMessages(serverId, channelId, callback, messageLimit = CHAT_PAGE_SIZE) {
  const q = query(
    collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit),
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs;
    const msgs = docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    const oldestLiveDoc = docs.length ? docs[docs.length - 1] : null;
    callback(msgs, {
      oldestLiveDoc,
      isFullPage: docs.length === messageLimit,
    });
  }, snapshotErrorHandler('subscribeServerMessages'));
}

export async function loadOlderServerMessages(serverId, channelId, cursorDoc, batchSize = CHAT_PAGE_SIZE) {
  if (!cursorDoc) return { messages: [], oldestDocSnap: null, fetchedCount: 0 };
  const q = query(
    collection(db, 'servers', serverId, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(cursorDoc),
    limit(batchSize),
  );
  const snap = await getDocs(q);
  if (snap.empty) return { messages: [], oldestDocSnap: null, fetchedCount: 0 };
  const docs = snap.docs;
  const messages = docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
  const oldestDocSnap = docs[docs.length - 1];
  return { messages, oldestDocSnap, fetchedCount: docs.length };
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

// ─── Default Server (Fluxy Community) ─────────────────────────────────────────

export async function ensureDefaultServer(uid) {
  const ref = doc(db, 'servers', DEFAULT_SERVER_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        name: 'Fluxy Community',
        icon: null,
        owner: uid,
        members: [uid],
        channels: DEFAULT_SERVER_CHANNELS,
        createdAt: serverTimestamp(),
      });
    } catch {
      const retry = await getDoc(ref);
      if (retry.exists() && !retry.data().members?.includes(uid)) {
        await updateDoc(ref, { members: arrayUnion(uid) });
      }
    }
  } else if (!snap.data().members?.includes(uid)) {
    await updateDoc(ref, { members: arrayUnion(uid) });
  }
}

// ─── Server Invites ───────────────────────────────────────────────────────────
//
// Model: serverInvites/{inviteCode} where inviteCode is an opaque id (not the server id).
// - serverId: the only server this code can add members to (immutable after create).
// - uses / maxUses / expiresAt: redemption limits (see useServerInvite transaction).
// Join flow always loads servers/{invite.serverId} from the invite doc — no cross-server join.

function generateInviteCode(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < length; i++) code += chars[bytes[i] % chars.length];
  return code;
}

/** True if uid is the server document owner (Firestore `owner` field). */
export function isServerOwner(server, uid) {
  return Boolean(server && uid && server.owner === uid);
}

/**
 * Creates `serverInvites/{code}` for one server. Re-reads the doc so the returned code and binding
 * always match what Firestore stored (avoids UI showing a code that doesn’t match the document).
 * @returns {{ code: string, boundServerId: string, boundServerName: string }}
 */
export async function createServerInvite(serverId, serverName, opts = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  const maxTries = 16;
  for (let t = 0; t < maxTries; t++) {
    const code = generateInviteCode(10);
    const ref = doc(db, 'serverInvites', code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    try {
      await setDoc(ref, {
        serverId,
        serverName: serverName || '',
        createdBy: uid,
        createdAt: serverTimestamp(),
        expiresAt: opts.expiresAt || null,
        maxUses: opts.maxUses ?? 0,
        uses: 0,
      });
      const verify = await getDoc(ref);
      if (!verify.exists()) throw new Error('Invite was not saved');
      const data = verify.data();
      if (data.serverId !== serverId) {
        throw new Error('Invite is bound to a different server than requested');
      }
      return {
        code: verify.id,
        boundServerId: data.serverId,
        boundServerName: (data.serverName || serverName || '').trim(),
      };
    } catch (err) {
      if (err?.code === 'permission-denied') {
        throw new Error(
          'No permission to create invites for this server. You must be a member; deploy latest firestore.rules if this persists.',
        );
      }
      const msg = typeof err?.message === 'string' ? err.message : '';
      if (msg.includes('Invite is bound') || msg.includes('Invite was not saved')) throw err;
      continue;
    }
  }
  throw new Error('Could not generate a unique invite code. Try again.');
}

export async function deleteServer(serverId) {
  await deleteDoc(doc(db, 'servers', serverId));
}

/** Replace the full channels array (owner-only in rules). */
export async function replaceServerChannels(serverId, channels) {
  await updateDoc(doc(db, 'servers', serverId), { channels });
}

export async function getServerInvite(inviteCode) {
  const code = (inviteCode || '').trim();
  if (!code) return null;
  const snap = await getDoc(doc(db, 'serverInvites', code));
  return snap.exists() ? { code: snap.id, ...snap.data() } : null;
}

/**
 * Redeem an invite: atomically validates code → target server, adds member, increments uses.
 * Invite always carries serverId; join only affects that server (no cross-server reuse).
 */
export async function useServerInvite(inviteCode, uid) {
  const code = (inviteCode || '').trim();
  if (!code) throw new Error('Enter an invite code');
  const inviteRef = doc(db, 'serverInvites', code);

  return runTransaction(db, async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists()) throw new Error('Invalid invite code');

    const invite = inviteSnap.data();
    const targetServerId = invite.serverId;
    if (!targetServerId || typeof targetServerId !== 'string') {
      throw new Error('This invite is missing a server and cannot be used');
    }

    if (invite.expiresAt) {
      const expires = invite.expiresAt.toDate
        ? invite.expiresAt.toDate()
        : new Date(invite.expiresAt);
      if (expires < new Date()) throw new Error('Invite has expired');
    }

    const uses = typeof invite.uses === 'number' ? invite.uses : 0;
    const maxUses = typeof invite.maxUses === 'number' ? invite.maxUses : 0;
    if (maxUses > 0 && uses >= maxUses) throw new Error('Invite has reached max uses');

    const serverRef = doc(db, 'servers', targetServerId);
    const serverSnap = await transaction.get(serverRef);
    if (!serverSnap.exists()) throw new Error('Server no longer exists');

    const members = serverSnap.data().members || [];
    if (members.includes(uid)) throw new Error('Already a member');

    transaction.update(serverRef, { members: arrayUnion(uid) });
    transaction.update(inviteRef, { uses: increment(1) });

    return targetServerId;
  });
}

// ─── Message Actions ──────────────────────────────────────────────────────────

function resolveMessageRef(context, msgId) {
  if (!context || !msgId) return null;
  const { type, dmId, groupId, serverId, channelId } = context;
  if (type === 'dm' && dmId) return doc(db, 'directMessages', dmId, 'messages', msgId);
  if (type === 'group' && groupId) return doc(db, 'groupChats', groupId, 'messages', msgId);
  if (type === 'server' && serverId && channelId)
    return doc(db, 'servers', serverId, 'channels', channelId, 'messages', msgId);
  return null;
}

export async function addReaction(context, msgId, emoji, uid) {
  const ref = resolveMessageRef(context, msgId);
  if (!ref) return;
  await updateDoc(ref, { [`reactions.${emoji}`]: arrayUnion(uid) });
}

export async function removeReaction(context, msgId, emoji, uid) {
  const ref = resolveMessageRef(context, msgId);
  if (!ref) return;
  await updateDoc(ref, { [`reactions.${emoji}`]: arrayRemove(uid) });
}

export async function editMessage(context, msgId, newText) {
  const ref = resolveMessageRef(context, msgId);
  if (!ref) return;
  await updateDoc(ref, { text: newText, editedAt: serverTimestamp() });
}

export async function deleteMessage(context, msgId) {
  const ref = resolveMessageRef(context, msgId);
  if (!ref) return;
  await deleteDoc(ref);
}

export async function submitMessageReport({ context, msgId, messageText, targetUid, reason }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in required');
  await addDoc(collection(db, 'reports'), {
    reporterUid: uid,
    type: 'message',
    messageId: msgId || null,
    messageText: (messageText || '').slice(0, 500),
    targetUid: targetUid || null,
    channelType: context?.type || null,
    channelId: context?.dmId || context?.groupId || context?.channelId || null,
    serverId: context?.serverId || null,
    reason: (reason || '').slice(0, 1000),
    status: 'open',
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
    subject: data.subject || null,
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
