import { slotsToEquipDataAttrs } from '../../lib/inclidesShopUtils';
import '../../pages/ProfilePage.css';
import '../../pages/profileCosmetics.css';
import './ProfileLookPreview.css';

/**
 * Same profile hero markup + data-equip-* attrs as the public Profile page,
 * so cosmetics look identical for you and for everyone else.
 */
export default function ProfileLookPreview({ equippedSlots, username, avatarColor }) {
  const attrs = slotsToEquipDataAttrs(equippedSlots || {});
  const name = (username || 'You').trim() || 'You';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="profile-page profile-look-preview-root" {...attrs}>
      <section className="profile-hero glass-card fluxy-premium-surface">
        <div className="profile-banner" />
        <div className="profile-hero-inner">
          <div
            className="profile-avatar-lg"
            style={{ background: avatarColor || 'var(--accent)' }}
          >
            {initial}
          </div>
          <div className="profile-hero-text">
            <h2>{name}</h2>
            <p className="profile-bio">
              Same live look as your public profile — others see this when they visit you.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
