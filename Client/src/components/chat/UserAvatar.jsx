const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#22d3ee', '#34d399', '#f97316', '#a855f7', '#38bdf8',
];

function pickColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function UserAvatar({ user, size = 40, className = '' }) {
  const name = user?.username || '?';
  const avatar = user?.avatar;
  const color = user?.color || pickColor(name);

  return (
    <div
      className={`dc-user-avatar ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: '50%',
        background: avatar ? 'transparent' : color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: '#fff',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export { pickColor, AVATAR_COLORS };
