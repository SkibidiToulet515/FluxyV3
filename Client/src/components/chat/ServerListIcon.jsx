/**
 * Server rail row: avatar switches the active server; ⋮ (CSS dots) opens the action menu.
 * Dots are plain DOM nodes so they always paint (SVG icons were easy to clip/stack under the avatar).
 */
export default function ServerListIcon({
  server,
  active,
  menuOpen,
  onSelectServer,
  onOpenMenu,
}) {
  return (
    <div className="dc-server-entry">
      <button
        type="button"
        data-server-id={server.id}
        className={`dc-server-icon dc-server-icon-main ${active ? 'active' : ''}`}
        title={`${server.name} — open channels`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectServer(server);
        }}
      >
        <span className="dc-server-pill" aria-hidden />
        <div className="dc-server-avatar" style={{ '--server-color': 'var(--accent)' }}>
          {server.icon ? (
            <img src={server.icon} alt="" className="dc-server-avatar-img" />
          ) : (
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              {server.name?.charAt(0)?.toUpperCase() || 'S'}
            </span>
          )}
        </div>
      </button>
      <button
        type="button"
        className="dc-server-kebab"
        data-server-menu-trigger
        title={`${server.name} — settings & invites`}
        aria-label={`${server.name} options`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu(server, e.currentTarget);
        }}
      >
        <span className="dc-kebab-icon" aria-hidden>
          <span className="dc-kebab-dot" />
          <span className="dc-kebab-dot" />
          <span className="dc-kebab-dot" />
        </span>
      </button>
    </div>
  );
}
