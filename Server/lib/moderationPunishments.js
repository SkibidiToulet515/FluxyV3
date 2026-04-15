import admin from 'firebase-admin';

/**
 * Creates linked `punishments/{id}` docs + user fields for appeals / history.
 */

export async function createWarningPunishment(db, { targetUid, issuedBy, reason }) {
  const pRef = db.collection('punishments').doc();
  const pid = pRef.id;
  const entry = {
    id: pid,
    at: new Date().toISOString(),
    reason,
    by: issuedBy,
  };
  const now = admin.firestore.FieldValue.serverTimestamp();
  await pRef.set({
    userId: targetUid,
    type: 'warning',
    reason,
    issuedBy,
    issuedAt: now,
    expiresAt: null,
    active: true,
    warningEntry: entry,
    appealOpen: false,
    createdAt: now,
  });
  await db.collection('users').doc(targetUid).update({
    warnings: admin.firestore.FieldValue.arrayUnion(entry),
  });
  return pid;
}

export async function createMutePunishment(db, { targetUid, issuedBy, reason, until }) {
  const pRef = db.collection('punishments').doc();
  const pid = pRef.id;
  const r = (reason || '').trim() || 'No reason provided';
  const isoIssued = new Date().toISOString();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await pRef.set({
    userId: targetUid,
    type: 'mute',
    reason: r,
    issuedBy,
    issuedAt: now,
    expiresAt: admin.firestore.Timestamp.fromDate(until),
    active: true,
    appealOpen: false,
    createdAt: now,
  });

  const uref = db.collection('users').doc(targetUid);
  const prev = await uref.get();
  const prevPid = prev.data()?.activeMutePunishmentId;
  if (prevPid) {
    const old = db.collection('punishments').doc(prevPid);
    const os = await old.get();
    if (os.exists) {
      await old.update({
        active: false,
        liftedAt: now,
        liftedBy: 'superseded',
      });
    }
  }

  await uref.update({
    mutedUntil: admin.firestore.Timestamp.fromDate(until),
    muteReason: r,
    muteIssuedBy: issuedBy,
    muteIssuedAt: isoIssued,
    activeMutePunishmentId: pid,
  });
  return pid;
}

export async function clearMutePunishment(db, targetUid) {
  const uref = db.collection('users').doc(targetUid);
  const prev = await uref.get();
  const prevPid = prev.data()?.activeMutePunishmentId;
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (prevPid) {
    const old = db.collection('punishments').doc(prevPid);
    const os = await old.get();
    if (os.exists) {
      await old.update({ active: false, liftedAt: now, liftedBy: 'unmute' });
    }
  }
  await uref.update({
    mutedUntil: admin.firestore.FieldValue.delete(),
    muteReason: admin.firestore.FieldValue.delete(),
    muteIssuedBy: admin.firestore.FieldValue.delete(),
    muteIssuedAt: admin.firestore.FieldValue.delete(),
    activeMutePunishmentId: admin.firestore.FieldValue.delete(),
  });
}

export async function createBanPunishment(db, { targetUid, issuedBy, reason }) {
  const pRef = db.collection('punishments').doc();
  const pid = pRef.id;
  const r = (reason || '').trim() || 'No reason provided';
  const isoIssued = new Date().toISOString();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await pRef.set({
    userId: targetUid,
    type: 'ban',
    reason: r,
    issuedBy,
    issuedAt: now,
    expiresAt: null,
    active: true,
    appealOpen: false,
    createdAt: now,
  });
  await db.collection('users').doc(targetUid).update({
    banned: true,
    banReason: r,
    banIssuedBy: issuedBy,
    banIssuedAt: isoIssued,
    activeBanPunishmentId: pid,
  });
  return pid;
}

export async function clearBanPunishment(db, targetUid) {
  const uref = db.collection('users').doc(targetUid);
  const prev = await uref.get();
  const prevPid = prev.data()?.activeBanPunishmentId;
  const now = admin.firestore.FieldValue.serverTimestamp();
  if (prevPid) {
    const old = db.collection('punishments').doc(prevPid);
    const os = await old.get();
    if (os.exists) {
      await old.update({ active: false, liftedAt: now, liftedBy: 'unban' });
    }
  }
  await uref.update({
    banned: false,
    banReason: admin.firestore.FieldValue.delete(),
    banIssuedBy: admin.firestore.FieldValue.delete(),
    banIssuedAt: admin.firestore.FieldValue.delete(),
    activeBanPunishmentId: admin.firestore.FieldValue.delete(),
  });
}
