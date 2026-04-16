/**
 * Shared home-style section (title row + optional action + empty state).
 * Uses `home-section` styles from Home.css when rendered on Home.
 */
export default function PageSection({ title, icon: Icon, action, children, empty }) {
  return (
    <section className="home-section fluxy-page-section">
      <div className="section-header">
        <div className="section-title-row">
          {Icon ? <Icon size={20} /> : null}
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {empty ? <p className="home-empty">{empty}</p> : children}
    </section>
  );
}
