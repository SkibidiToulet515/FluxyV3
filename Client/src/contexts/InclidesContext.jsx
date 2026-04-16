import {
  createContext, useContext, useMemo, useState, useEffect, useCallback,
} from 'react';
import { useAuth } from '../utils/AuthContext';
import {
  fetchInclidesMe,
  postDailyClaim,
  postInclidesPurchase,
  postInclidesEquip,
} from '../services/inclidesApi';

const InclidesContext = createContext(null);

export function InclidesProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await fetchInclidesMe();
      setData(d);
    } catch (e) {
      setError(e.message || 'Unavailable');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const claimDaily = useCallback(async () => {
    const out = await postDailyClaim();
    await refresh();
    return out;
  }, [refresh]);

  const purchase = useCallback(
    async (itemId) => {
      const out = await postInclidesPurchase(itemId);
      await refresh();
      return out;
    },
    [refresh],
  );

  const equip = useCallback(
    async (payload) => {
      const out = await postInclidesEquip(payload);
      await refresh();
      return out;
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      balance: data?.balance ?? 0,
      streak: data?.streak ?? 0,
      canClaimToday: data?.canClaimToday ?? false,
      previewNextReward: data?.previewNextReward ?? 0,
      nextStreakIfClaim: data?.nextStreakIfClaim ?? 1,
      ownedItemIds: data?.ownedItemIds ?? [],
      equippedItemId: data?.equippedItemId ?? null,
      equippedSlots: data?.equippedSlots ?? {},
      refresh,
      claimDaily,
      purchase,
      equip,
    }),
    [loading, error, data, refresh, claimDaily, purchase, equip],
  );

  return (
    <InclidesContext.Provider value={value}>
      {children}
    </InclidesContext.Provider>
  );
}

export function useInclides() {
  const ctx = useContext(InclidesContext);
  if (!ctx) {
    throw new Error('useInclides must be used within InclidesProvider');
  }
  return ctx;
}
