/**
 * Default shapes for giveaway eligibility + entry requirement rules (stored on giveaway docs).
 */

export function defaultEligibility() {
  return {
    audience: 'all', // 'all' | 'roles' | 'invited' | 'whitelist'
    roleKeys: [],
    invitedUserIds: [],
    joinedBefore: null,
    joinedAfter: null,
    minInvites: 0,
    minMessages: 0,
    whitelistUsernames: [],
    blacklistUsernames: [],
    excludeBanned: true,
    excludeFlaggedAlts: true,
  };
}

export function defaultRequirementRules() {
  return {
    mustBeLoggedIn: true,
    mustVerifyEmail: false,
    mustAcceptTerms: false,
    termsText: 'I have read and agree to the giveaway rules.',
    mustCompleteReferralOnboarding: false,
    mustJoinServerId: null,
    minInvitesToEnter: 0,
    accountOlderThanDays: 0,
  };
}

export function normalizeEligibility(raw) {
  const d = defaultEligibility();
  if (!raw || typeof raw !== 'object') return d;
  return {
    ...d,
    audience: ['all', 'roles', 'invited', 'whitelist'].includes(raw.audience) ? raw.audience : d.audience,
    roleKeys: Array.isArray(raw.roleKeys) ? raw.roleKeys.map(String) : d.roleKeys,
    invitedUserIds: Array.isArray(raw.invitedUserIds) ? raw.invitedUserIds.map(String) : d.invitedUserIds,
    joinedBefore: raw.joinedBefore ?? null,
    joinedAfter: raw.joinedAfter ?? null,
    minInvites: Math.max(0, Number(raw.minInvites) || 0),
    minMessages: Math.max(0, Number(raw.minMessages) || 0),
    whitelistUsernames: Array.isArray(raw.whitelistUsernames)
      ? raw.whitelistUsernames.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : d.whitelistUsernames,
    blacklistUsernames: Array.isArray(raw.blacklistUsernames)
      ? raw.blacklistUsernames.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
      : d.blacklistUsernames,
    excludeBanned: raw.excludeBanned !== false,
    excludeFlaggedAlts: raw.excludeFlaggedAlts !== false,
  };
}

export function normalizeRequirementRules(raw) {
  const d = defaultRequirementRules();
  if (!raw || typeof raw !== 'object') return d;
  return {
    ...d,
    mustBeLoggedIn: raw.mustBeLoggedIn !== false,
    mustVerifyEmail: Boolean(raw.mustVerifyEmail),
    mustAcceptTerms: Boolean(raw.mustAcceptTerms),
    termsText: typeof raw.termsText === 'string' ? raw.termsText.slice(0, 500) : d.termsText,
    mustCompleteReferralOnboarding: Boolean(raw.mustCompleteReferralOnboarding),
    mustJoinServerId: raw.mustJoinServerId ? String(raw.mustJoinServerId) : null,
    minInvitesToEnter: Math.max(0, Number(raw.minInvitesToEnter) || 0),
    accountOlderThanDays: Math.max(0, Number(raw.accountOlderThanDays) || 0),
  };
}
