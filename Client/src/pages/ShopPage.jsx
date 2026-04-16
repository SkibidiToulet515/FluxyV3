import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ShoppingBag, Loader2, Check, X, Eye, ArrowUpDown,
} from 'lucide-react';
import Header from '../components/Header';
import { fetchInclidesShop, formatInclidesLine } from '../services/inclidesApi';
import { useInclides } from '../contexts/InclidesContext';
import InclidesSymbol from '../components/inclides/InclidesSymbol';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { CATEGORY_ORDER, rarityRank, slotKeyForCategory } from '../lib/inclidesShopUtils';
import './ShopPage.css';

function rarityClass(r) {
  const x = String(r || 'Common').toLowerCase();
  return `shop-rarity--${x}`;
}

export default function ShopPage() {
  const { onMenuToggle } = useOutletContext();
  const { balance, ownedItemIds, equippedSlots, purchase } = useInclides();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [msg, setMsg] = useState(null);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('rarity-desc');
  const [preview, setPreview] = useState(null);

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

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return CATEGORY_ORDER.filter((c) => set.has(c));
  }, [items]);

  const filteredSorted = useMemo(() => {
    let list = category === 'all' ? [...items] : items.filter((i) => i.category === category);
    list.sort((a, b) => {
      if (sort === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (sort === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (sort === 'rarity-asc') return rarityRank(a.rarity) - rarityRank(b.rarity);
      return rarityRank(b.rarity) - rarityRank(a.rarity);
    });
    return list;
  }, [items, category, sort]);

  const ownedSet = new Set(ownedItemIds);

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

  return (
    <div className="shop-page animate-fade-in">
      <Header title="Shop" onMenuClick={onMenuToggle} />

      <section className="shop-hero glass-card">
        <div className="shop-hero-inner">
          <ShoppingBag size={28} className="shop-hero-icon" />
          <div>
            <h2>Cosmetics</h2>
            <p>
              Spend Inclides on profile flair and banners. Earn Inclides by using Fluxy — not pay-to-win.
            </p>
          </div>
        </div>
        <div className="shop-balance">
          <InclidesSymbol size={22} />
          <span>Balance: {formatInclidesLine(balance)}</span>
        </div>
      </section>

      {msg ? <p className="shop-msg glass-card">{msg}</p> : null}

      <div className="shop-toolbar glass-card">
        <div className="shop-cats" role="tablist" aria-label="Categories">
          <button
            type="button"
            className={`shop-cat ${category === 'all' ? 'active' : ''}`}
            onClick={() => setCategory('all')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`shop-cat ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="shop-sort">
          <ArrowUpDown size={16} aria-hidden />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort"
          >
            <option value="rarity-desc">Rarity (high first)</option>
            <option value="rarity-asc">Rarity (low first)</option>
            <option value="price-asc">Price (low first)</option>
            <option value="price-desc">Price (high first)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="shop-skeleton-wrap">
          <SkeletonGrid count={8} />
        </div>
      ) : (
        <div className="shop-grid">
          {filteredSorted.map((item) => {
            const owned = ownedSet.has(item.id);
            const affordable = balance >= (item.price || 0);
            const busy = buying === item.id;
            const sk = slotKeyForCategory(item.category);
            const equipped = equippedSlots?.[sk] === item.id;
            return (
              <article
                key={item.id}
                className={`shop-card glass-card ${rarityClass(item.rarity)}`}
                data-item-id={item.id}
              >
                <button
                  type="button"
                  className="shop-card-preview-hit"
                  onClick={() => setPreview(item)}
                  title="Preview"
                >
                  <Eye size={16} />
                </button>
                <div className={`shop-card-visual ${rarityClass(item.rarity)}`}>
                  <InclidesSymbol size={36} />
                </div>
                <p className="shop-card-cat">{item.category}</p>
                <h3>{item.name}</h3>
                <p className="shop-card-desc">{item.description}</p>
                <span className={`shop-rarity-pill ${rarityClass(item.rarity)}`}>{item.rarity || 'Common'}</span>
                <p className="shop-card-cost">Cost: {formatInclidesLine(item.price)}</p>
                {owned ? (
                  <span className="shop-owned">
                    <Check size={14} /> {equipped ? 'Equipped' : 'Owned'}
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

      {preview ? (
        <div className="shop-modal-overlay" role="dialog" aria-modal aria-labelledby="shop-preview-title">
          <div className="shop-modal glass-card">
            <button type="button" className="shop-modal-close" onClick={() => setPreview(null)} aria-label="Close">
              <X size={20} />
            </button>
            <div className={`shop-modal-visual ${rarityClass(preview.rarity)}`}>
              <InclidesSymbol size={48} />
            </div>
            <h3 id="shop-preview-title">{preview.name}</h3>
            <p className="shop-modal-meta">{preview.category} · {preview.rarity}</p>
            <p className="shop-modal-desc">{preview.description}</p>
            <p className="shop-modal-price">{formatInclidesLine(preview.price)}</p>
            <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
