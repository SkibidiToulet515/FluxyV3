import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Package, Loader2, Check } from 'lucide-react';
import Header from '../components/Header';
import { fetchInclidesShop } from '../services/inclidesApi';
import { useInclides } from '../contexts/InclidesContext';
import InclidesSymbol from '../components/inclides/InclidesSymbol';
import './InventoryPage.css';

export default function InventoryPage() {
  const { onMenuToggle } = useOutletContext();
  const { ownedItemIds, equippedItemId, equip } = useInclides();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

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

  const owned = new Set(ownedItemIds);
  const ownedList = items.filter((x) => owned.has(x.id));

  async function onEquip(itemId) {
    setBusy(itemId);
    try {
      await equip(itemId);
    } finally {
      setBusy(null);
    }
  }

  async function onClear() {
    setBusy('__clear');
    try {
      await equip(null);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="inventory-page animate-fade-in">
      <Header title="Inventory" onMenuClick={onMenuToggle} />

      <section className="inventory-hero glass-card">
        <Package size={26} className="inventory-hero-icon" />
        <div>
          <h2>Your cosmetics</h2>
          <p>Equip one look at a time. Items stay in your inventory forever.</p>
        </div>
      </section>

      {loading ? (
        <div className="inventory-loading">
          <Loader2 className="spin" size={22} /> Loading…
        </div>
      ) : ownedList.length === 0 ? (
        <p className="inventory-empty glass-card">
          Nothing here yet — earn Inclides and visit the Shop.
        </p>
      ) : (
        <ul className="inventory-list">
          {ownedList.map((item) => {
            const isEq = equippedItemId === item.id;
            const b = busy === item.id;
            return (
              <li key={item.id} className="inventory-row glass-card">
                <InclidesSymbol size={28} />
                <div className="inventory-row-text">
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </div>
                {isEq ? (
                  <span className="inventory-equipped">
                    <Check size={14} /> Equipped
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={b}
                    onClick={() => onEquip(item.id)}
                  >
                    {b ? '…' : 'Equip'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ownedList.length > 0 && equippedItemId ? (
        <button type="button" className="btn btn-ghost inventory-clear" onClick={onClear} disabled={busy === '__clear'}>
          Clear equipped look
        </button>
      ) : null}
    </div>
  );
}
