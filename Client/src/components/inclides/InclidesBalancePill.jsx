import { Link } from 'react-router-dom';
import InclidesSymbol from './InclidesSymbol';
import { useInclides } from '../../contexts/InclidesContext';
import { formatInclidesAmount } from '../../services/inclidesApi';
import './InclidesBalancePill.css';

const TOOLTIP =
  'Inclides are earned by using Fluxy and can be spent on profile cosmetics.';

export default function InclidesBalancePill({ compact = false }) {
  const { balance, loading } = useInclides();
  const balStr = loading ? '…' : formatInclidesAmount(balance);

  return (
    <Link
      to="/wallet"
      className={`inclides-balance-pill glass-bg ${compact ? 'inclides-balance-pill--compact' : ''}`}
      title={TOOLTIP}
      aria-label={loading ? 'Inclides balance loading' : `${balStr} Inclides. ${TOOLTIP}`}
    >
      <InclidesSymbol size={compact ? 16 : 18} />
      <span className={`inclides-balance-pill-value ${loading ? 'is-loading' : ''}`}>
        {balStr}
      </span>
      <span className="inclides-balance-pill-label">Inclides</span>
    </Link>
  );
}
