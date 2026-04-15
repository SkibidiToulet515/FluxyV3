/**
 * Eligibility + entry requirement checks for giveaways (server-side).
 */
import admin from 'firebase-admin';

function tsToMillis(t) {
  if (!t) return null;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t._seconds != null) return t._seconds * 1000;
  return null;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {ReturnType<import('./giveawaySchema.js').normalizeEligibility>} eligibility
 */
export async function userMatchesEligibility(db, uid, userData, eligibility) {
  const usernameLower = (userData.usernameLower || userData.username || '').toString().toLowerCase();

  if (eligibility.blacklistUsernames?.length && eligibility.blacklistUsernames.includes(usernameLower)) {
    return { ok: false, code: 'BLACKLIST' };
  }

  if (eligibility.excludeBanned && userData.banned === true) {
    return { ok: false, code: 'BANNED' };
  }
  if (eligibility.excludeFlaggedAlts && userData.flaggedAlt === true) {
    return { ok: false, code: 'FLAGGED' };
  }

  if (eligibility.audience === 'whitelist') {
    if (!eligibility.whitelistUsernames?.length || !eligibility.whitelistUsernames.includes(usernameLower)) {
      return { ok: false, code: 'WHITELIST' };
    }
  }

  if (eligibility.audience === 'roles' && eligibility.roleKeys?.length) {
    const role = userData.role || 'user';
    if (!eligibility.roleKeys.includes(role)) {
      return { ok: false, code: 'ROLE' };
    }
  }

  if (eligibility.audience === 'invited' && eligibility.invitedUserIds?.length) {
    if (!eligibility.invitedUserIds.includes(uid)) {
      return { ok: false, code: 'NOT_INVITED' };
    }
  }

  const createdMs = tsToMillis(userData.createdAt);
  if (eligibility.joinedBefore != null && createdMs != null) {
    const beforeMs = tsToMillis(eligibility.joinedBefore) ?? Number(eligibility.joinedBefore);
    if (createdMs > beforeMs) return { ok: false, code: 'JOINED_AFTER' };
  }
  if (eligibility.joinedAfter != null && createdMs != null) {
    const afterMs = tsToMillis(eligibility.joinedAfter) ?? Number(eligibility.joinedAfter);
    if (createdMs < afterMs) return { ok: false, code: 'JOINED_BEFORE' };
  }

  const invites = Number(userData.inviteCount ?? userData.invites ?? 0);
  if (eligibility.minInvites > 0 && invites < eligibility.minInvites) {
    return { ok: false, code: 'MIN_INVITES' };
  }

  const messages = Number(userData.messageCount ?? userData.stats?.messageCount ?? 0);
  if (eligibility.minMessages > 0 && messages < eligibility.minMessages) {
    return { ok: false, code: 'MIN_MESSAGES' };
  }

  return { ok: true };
}

/**
 * @param {import('firebase-admin/auth').Auth} auth
 */
export async function userMeetsEntryRequirements(auth, db, uid, userData, reqRules) {
  if (reqRules.mustBeLoggedIn !== false && !uid) {
    return { ok: false, code: 'AUTH' };
  }

  if (reqRules.mustVerifyEmail) {
    try {
      const u = await auth.getUser(uid);
      if (!u.emailVerified) return { ok: false, code: 'EMAIL' };
    } catch {
      return { ok: false, code: 'AUTH_USER' };
    }
  }

  if (reqRules.accountOlderThanDays > 0) {
    const createdMs = tsToMillis(userData.createdAt);
    if (createdMs == null) return { ok: false, code: 'ACCOUNT_AGE_UNKNOWN' };
    const minMs = reqRules.accountOlderThanDays * 86400000;
    if (Date.now() - createdMs < minMs) return { ok: false, code: 'ACCOUNT_TOO_NEW' };
  }

  if (reqRules.mustCompleteReferralOnboarding && userData.hasCompletedReferral !== true) {
    return { ok: false, code: 'REFERRAL_ONBOARDING' };
  }

  const referralCount = Array.isArray(userData.referrals) ? userData.referrals.length : 0;
  if (reqRules.minInvitesToEnter > 0 && referralCount < reqRules.minInvitesToEnter) {
    return { ok: false, code: 'MIN_INVITES_ENTER' };
  }

  if (reqRules.mustJoinServerId) {
    const sid = reqRules.mustJoinServerId;
    const sref = db.collection('servers').doc(sid);
    const snap = await sref.get();
    if (!snap.exists) return { ok: false, code: 'SERVER_MISSING' };
    const members = snap.data()?.members;
    if (!Array.isArray(members) || !members.includes(uid)) {
      return { ok: false, code: 'NOT_IN_SERVER' };
    }
  }

  return { ok: true };
}
