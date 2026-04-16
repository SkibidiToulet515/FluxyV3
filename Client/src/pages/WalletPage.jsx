import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import Header from '../components/Header';
import { fetchInclidesTransactions, formatInclidesLine } from '../services/inclidesApi';
import { useInclides } from '../contexts/InclidesContext';
import InclidesSymbol from '../components/inclides/InclidesSymbol';
import './WalletPage.css';

function sourceLabel(src) {
  const map = {
    daily_reward: 'Daily reward',
    shop_purchase: 'Shop',
    admin_adjust: 'Adjustment',
  };
  return map[src] || src || '—';
}

export default function WalletPage() {
  const { onMenuToggle } = useOutletContext();
  const { balance } = useInclides();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchInclidesTransactions(80);
        if (!cancelled) setRows(d.transactions || []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="wallet-page animate-fade-in">
      <Header title="Inclides activity" onMenuClick={onMenuToggle} />

      <section className="wallet-hero glass-card">
        <InclidesSymbol size={36} />
        <div>
          <p className="wallet-label">Balance</p>
          <p className="wallet-balance">{formatInclidesLine(balance)}</p>
        </div>
      </section>

      <section className="wallet-section glass-card">
        <h3>Recent activity</h3>
        {loading ? (
          <p className="wallet-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="wallet-muted">No activity yet. Earn Inclides daily from Home.</p>
        ) : (
          <ul className="wallet-list">
            {rows.map((tx) => {
              const earn = tx.type === 'earn' || (tx.amountSigned && tx.amountSigned > 0);
              const amt = Math.abs(tx.amountSigned || 0);
              return (
                <li key={tx.id} className={`wallet-row ${earn ? 'wallet-row--earn' : 'wallet-row--spend'}`}>
                  <span className="wallet-icon">
                    {earn ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </span>
                  <div className="wallet-row-main">
                    <span className="wallet-source">{sourceLabel(tx.source)}</span>
                    <time className="wallet-time">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}
                    </time>
                  </div>
                  <span className="wallet-amt">
                    {earn ? '+' : '−'}
                    {amt.toLocaleString()} Inclides
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
