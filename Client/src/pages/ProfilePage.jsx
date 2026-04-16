import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Calendar, Gamepad2, Heart, Star, Sparkles, Users, MessageCircle,
} from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../utils/AuthContext';
import {
  getUserByUsername,
  sendFriendRequest,
  subscribeFriends,
  getUserDoc,
} from '../services/firestore';
import { useLibrary } from '../contexts/LibraryContext';
import { useInclides } from '../contexts/InclidesContext';
import InclidesSymbol from '../components/inclides/InclidesSymbol';
import { formatInclidesAmount } from '../services/inclidesApi';
import './ProfilePage.css';
import './profileCosmetics.css';

export default function ProfilePage() {
  const { username } = useParams();
  const { onMenuToggle } = useOutletContext();
  const { user, account } = useAuth();
  const { favorites, collections } = useLibrary();
  const { balance: inclidesBalance, equippedSlots: selfSlots } = useInclides();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendsPreview, setFriendsPreview] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const friendPreviewDebounceRef = useRef(null);
  const friendPreviewGenRef = useRef(0);

  const isSelf =
    !username
    || (account?.username && username.toLowerCase() === account.username.toLowerCase());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isSelf && account) {
          setProfile(account);
        } else if (username) {
          const u = await getUserByUsername(username);
          if (!cancelled) setProfile(u);
        } else {
          setProfile(account || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, account, isSelf]);

  useEffect(() => {
    if (!isSelf || !account?.uid) {
      setFriendsPreview([]);
      setFriendCount(0);
      return undefined;
    }
    const uid = account.uid;
    return subscribeFriends(uid, (list) => {
      setFriendCount(list.length);
      const others = list
        .slice(0, 8)
        .map((f) => f.users?.find((u) => u !== uid))
        .filter(Boolean);

      if (friendPreviewDebounceRef.current) {
        clearTimeout(friendPreviewDebounceRef.current);
      }
      friendPreviewDebounceRef.current = setTimeout(async () => {
        const gen = ++friendPreviewGenRef.current;
        try {
          const previews = await Promise.all(
            others.map(async (otherUid) => {
              try {
                const u = await getUserDoc(otherUid);
                return {
                  uid: otherUid,
                  username: u?.username || otherUid.slice(0, 8),
                };
              } catch {
                return { uid: otherUid, username: otherUid.slice(0, 8) };
              }
            }),
          );
          if (gen !== friendPreviewGenRef.current) return;
          setFriendsPreview(previews);
        } catch {
          if (gen !== friendPreviewGenRef.current) return;
          setFriendsPreview(
            others.map((otherUid) => ({ uid: otherUid, username: otherUid.slice(0, 8) })),
          );
        }
      }, 320);
    });
  }, [isSelf, account?.uid]);

  useEffect(
    () => () => {
      if (friendPreviewDebounceRef.current) {
        clearTimeout(friendPreviewDebounceRef.current);
      }
    },
    [],
  );

  const favN = isSelf ? favorites.length : 0;
  const colN = isSelf ? collections.length : 0;

  async function addFriend() {
    if (!profile?.uid || !user) return;
    setFriendBusy(true);
    try {
      await sendFriendRequest(null, profile.uid);
      alert('Friend request sent');
    } catch (e) {
      alert(e.message || 'Could not send request');
    } finally {
      setFriendBusy(false);
    }
  }

  const created = profile?.createdAt?.toDate
    ? profile.createdAt.toDate().toLocaleDateString()
    : profile?.createdAt
      ? new Date(profile.createdAt).toLocaleDateString()
      : '—';

  const equipAttrs = useMemo(() => {
    let slots = {};
    if (isSelf) {
      slots = selfSlots || {};
    } else if (profile) {
      slots = profile.inclidesEquippedSlots && typeof profile.inclidesEquippedSlots === 'object'
        ? { ...profile.inclidesEquippedSlots }
        : {};
      if (!Object.keys(slots).length && profile.inclidesEquippedItemId) {
        slots.frames = profile.inclidesEquippedItemId;
      }
    }
    const pick = (k) => (slots[k] ? String(slots[k]) : undefined);
    return {
      'data-equip-frames': pick('frames'),
      'data-equip-effects': pick('effects'),
      'data-equip-banners': pick('banners'),
      'data-equip-name-effects': pick('name_effects'),
      'data-equip-badges': pick('badges'),
      'data-equip-profile-backgrounds': pick('profile_backgrounds'),
      'data-equip-extras': pick('extras'),
    };
  }, [isSelf, selfSlots, profile]);

  return (
    <div
      className="profile-page animate-fade-in"
      {...equipAttrs}
    >
      <Header title={profile?.username || 'Profile'} onMenuClick={onMenuToggle} />

      {loading ? (
        <div className="profile-hero glass-card skeleton-block" />
      ) : !profile ? (
        <p className="profile-miss">User not found.</p>
      ) : (
        <>
          <section className="profile-hero glass-card fluxy-premium-surface">
            <div className="profile-banner" />
            <div className="profile-hero-inner">
              <div
                className="profile-avatar-lg"
                style={{ background: profile.color || 'var(--accent)' }}
              >
                {(profile.username || '?').charAt(0).toUpperCase()}
              </div>
              <div className="profile-hero-text">
                <h2>{profile.username}</h2>
                <p className="profile-bio">{profile.bio || 'No bio yet.'}</p>
                <div className="profile-meta-row">
                  <span>
                    <Calendar size={14} /> Joined {created}
                  </span>
                  <span className="profile-status-pill" data-status={profile.status || 'online'}>
                    {profile.status || 'online'}
                  </span>
                </div>
                {!isSelf && user ? (
                  <button
                    type="button"
                    className="btn btn-primary profile-friend-btn"
                    onClick={addFriend}
                    disabled={friendBusy}
                  >
                    Add friend
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="profile-stats glass-card">
            <h3>Stats</h3>
            <div className="profile-stat-grid">
              <div className="profile-stat">
                <Gamepad2 size={18} />
                <strong>{profile.totalGamePlays ?? 0}</strong>
                <span>plays</span>
              </div>
              <div className="profile-stat">
                <Heart size={18} />
                <strong>{isSelf ? favN : '—'}</strong>
                <span>favorites</span>
              </div>
              <div className="profile-stat">
                <Star size={18} />
                <strong>{isSelf ? colN : '—'}</strong>
                <span>collections</span>
              </div>
              <div className="profile-stat">
                <Users size={18} />
                <strong>{isSelf ? friendCount : '—'}</strong>
                <span>friends</span>
              </div>
              {isSelf ? (
                <div className="profile-stat profile-stat-inclides">
                  <InclidesSymbol size={18} />
                  <strong title="Inclides are earned by using Fluxy and can be spent on profile cosmetics.">
                    {formatInclidesAmount(inclidesBalance)}
                  </strong>
                  <span>Inclides</span>
                </div>
              ) : null}
            </div>
          </section>

          {isSelf && friendsPreview.length > 0 ? (
            <section className="profile-social glass-card">
              <h3><Users size={18} /> Friends</h3>
              <p className="profile-social-lead">
                <Link to="/chat" className="profile-chat-link">
                  <MessageCircle size={16} /> Open chat &amp; DMs
                </Link>
              </p>
              <ul className="profile-friends-list">
                {friendsPreview.map((f) => (
                  <li key={f.uid}>
                    <Link to={`/u/${encodeURIComponent(f.username)}`}>{f.username}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {isSelf ? (
            <section className="profile-hint glass-card">
              <h3><Sparkles size={18} /> Customize</h3>
              <p>
                Tune layout, blur, and motion in{' '}
                <Link to="/settings">Settings</Link>. Theme and background live there too.
              </p>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
