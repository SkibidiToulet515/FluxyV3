import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Package, Loader2, Check, Eye, X } from 'lucide-react';
import Header from '../components/Header';
import { fetchInclidesShop } from '../services/inclidesApi';
import { useInclides } from '../contexts/InclidesContext';
import { useAuth } from '../utils/AuthContext';
import InclidesSymbol from '../components/inclides/InclidesSymbol';
import ProfileLookPreview from '../components/inclides/ProfileLookPreview';
import { CATEGORY_ORDER, slotKeyForCategory } from '../lib/inclidesShopUtils';
import './InventoryPage.css';

export default function InventoryPage() {
  const { onMenuToggle } = useOutletContext();
  const { account } = useAuth();
  const { ownedItemIds, equippedSlots, equip } = useInclides();
  const [previewItem, setPreviewItem] = useState(null);
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

  const byCategory = useMemo(() => {
    const m = {};
    CATEGORY_ORDER.forEach((c) => {
      m[c] = [];
    });
    ownedList.forEach((item) => {
      const c = item.category || 'Extras';
      if (!m[c]) m[c] = [];
      m[c].push(item);
    });
    return m;
  }, [ownedList]);

  async function onEquip(item) {
    setBusy(item.id);
    try {
      await equip({ itemId: item.id });
    } finally {
      setBusy(null);
    }
  }

  async function onClearSlot(category) {
    const sk = slotKeyForCategory(category);
    setBusy(`clear-${sk}`);
    try {
      await equip({ clearSlot: sk });
    } finally {
      setBusy(null);
    }
  }

  async function onClearAll() {
    setBusy('__all');
    try {
      await equip({ clearAll: true });
    } finally {
      setBusy(null);
    }
  }

  const hasAny = ownedList.length > 0;

  const previewSlots = useMemo(() => {
    if (!previewItem) return equippedSlots || {};
    const sk = slotKeyForCategory(previewItem.category);
    return { ...(equippedSlots || {}), [sk]: previewItem.id };
  }, [previewItem, equippedSlots]);

  return (
    <div className="inventory-page animate-fade-in">
      <Header title="Inventory" onMenuClick={onMenuToggle} />

      <section className="inventory-hero glass-card">
        <Package size={26} className="inventory-hero-icon" />
        <div>
          <h2>Your cosmetics</h2>
          <p>
            Equip one item per category (frames, effects, banners, and more). Items stay forever.
            Preview shows the same live look as your public profile — what everyone else sees.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="inventory-loading">
          <Loader2 className="spin" size={22} /> Loading…
        </div>
      ) : !hasAny ? (
        <p className="inventory-empty glass-card">
          Nothing here yet — earn Inclides and visit the Shop.
        </p>
      ) : (
        <div className="inventory-sections">
          {CATEGORY_ORDER.map((cat) => {
            const rows = byCategory[cat] || [];
            if (!rows.length) return null;
            return (
              <section key={cat} className="inventory-cat glass-card">
                <div className="inventory-cat-head">
                  <h3>{cat}</h3>
                  {equippedSlots?.[slotKeyForCategory(cat)] ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm inventory-clear-slot"
                      disabled={busy === `clear-${slotKeyForCategory(cat)}`}
                      onClick={() => onClearSlot(cat)}
                    >
                      Clear {cat.toLowerCase()}
                    </button>
                  ) : null}
                </div>
                <ul className="inventory-list">
                  {rows.map((item) => {
                    const sk = slotKeyForCategory(item.category);
                    const isEq = equippedSlots?.[sk] === item.id;
                    const b = busy === item.id;
                    return (
                      <li key={item.id} className="inventory-row">
                        <div className={`inventory-visual inv-rarity--${String(item.rarity || 'Common').toLowerCase()}`}>
                          <InclidesSymbol size={28} />
                        </div>
                        <div className="inventory-row-text">
                          <strong>{item.name}</strong>
                          <span>{item.description}</span>
                        </div>
                        <div className="inventory-row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm inventory-preview-btn"
                            onClick={() => setPreviewItem(item)}
                            title="Preview on profile (global look)"
                          >
                            <Eye size={16} aria-hidden /> Preview
                          </button>
                          {isEq ? (
                            <span className="inventory-equipped">
                              <Check size={14} /> Equipped
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={b}
                              onClick={() => onEquip(item)}
                            >
                              {b ? '…' : 'Equip'}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {hasAny ? (
        <button
          type="button"
          className="btn btn-ghost inventory-clear"
          onClick={onClearAll}
          disabled={busy === '__all'}
        >
          Clear all equipped
        </button>
      ) : null}

      {previewItem ? (
        <div
          className="inventory-preview-overlay"
          role="dialog"
          aria-modal
          aria-labelledby="inventory-preview-title"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="inventory-preview-modal glass-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="inventory-preview-close"
              onClick={() => setPreviewItem(null)}
              aria-label="Close preview"
            >
              <X size={20} />
            </button>
            <h3 id="inventory-preview-title" className="inventory-preview-heading">
              {previewItem.name}
            </h3>
            <p className="inventory-preview-meta">
              {previewItem.category}
              {' · '}
              Public profile look (same for all viewers)
            </p>
            <div className="inventory-preview-body">
              <ProfileLookPreview
                equippedSlots={previewSlots}
                username={account?.username}
                avatarColor={account?.color}
              />
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setPreviewItem(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
