import { Link, useParams } from 'react-router-dom';
import Proxy from './Proxy';
import './RouteHostFallback.css';

/**
 * Canonical `/tools/:toolId` host. Keeps normal URLs for standalone windows.
 */
export default function ToolRouteHost() {
  const { toolId } = useParams();

  if (toolId === 'proxy') {
    return <Proxy />;
  }

  return (
    <div className="app-route-host glass-card animate-fade-in">
      <h2>Tool unavailable</h2>
      <p>
        No tool is registered for <code>{toolId ?? '—'}</code>. Try{' '}
        <Link to="/history">Proxy</Link> via the main navigation.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}
