import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShoppingBag, Loader2, Check } from 'lucide-react';
import Header from '../components/Header';
import { fetchInclidesShop, formatInclidesLine } from '../services/inclidesApi';
import { useInclides } from '../contexts/InclidesContext';
import InclidesSymbol from '../components/inclides/InclidesSymbol';
import './ShopPage.css';

export default function ShopPage() {
  const { onMenuToggle } = useOutletContext();
  const { balance, ownedItemIds, purchase } = useInclides();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchInclidesShop();
        if (!cancelled) setItems(d.items || []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onBuy(item) {
    if (buying) return;
    if (!window.confirm(`Purchase for ${formatInclidesLine(item.price)}?`)) return;
    setBuying(item.id);
    setMsg(null);
    try {
      await purchase(item.id);
      setMsg(`You now own ${item.name}. Open Inventory to equip.`);
    } catch (e) {
      setMsg(e.message || 'Could not purchase');
    } finally {
      setBuying(null);
    }
  }

  const ownedSet = new Set(ownedItemIds);

  return (
    <div className="shop-page animate-fade-in">
      <Header title="Shop" onMenuClick={onMenuToggle} />

      <section className="shop-hero glass-card">
        <div className="shop-hero-inner">
          <ShoppingBag size={28} className="shop-hero-icon" />
          <div>
            <h2>Cosmetics</h2>
            <p>
              Spend Inclides on profile flair and badges. Earn Inclides by using Fluxy daily — not pay-to-win.
            </p>
          </div>
        </div>
        <div className="shop-balance">
          <InclidesSymbol size={22} />
          <span>Balance: {formatInclidesLine(balance)}</span>
        </div>
      </section>

      {msg ? <p className="shop-msg glass-card">{msg}</p> : null}

      {loading ? (
        <div className="shop-loading">
          <Loader2 className="spin" size={22} /> Loading…
        </div>
      ) : (
        <div className="shop-grid">
          {items.map((item) => {
            const owned = ownedSet.has(item.id);
            const affordable = balance >= (item.price || 0);
            const busy = buying === item.id;
            return (
              <article key={item.id} className="shop-card glass-card">
                <div className="shop-card-icon">
                  <InclidesSymbol size={32} />
                </div>
                <h3>{item.name}</h3>
                <p className="shop-card-desc">{item.description}</p>
                <p className="shop-card-cost">Cost: {formatInclidesLine(item.price)}</p>
                {owned ? (
                  <span className="shop-owned">
                    <Check size={14} /> Owned
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary shop-buy"
                    disabled={!affordable || busy}
                    onClick={() => onBuy(item)}
                  >
                    {busy ? (
                      <>
                        <Loader2 size={16} className="spin" /> Processing…
                      </>
                    ) : affordable ? (
                      'Purchase'
                    ) : (
                      'Not enough Inclides'
                    )}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
