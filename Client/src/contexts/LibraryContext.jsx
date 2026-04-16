import {
  createContext, useContext, useMemo, useState, useEffect, useCallback,
} from 'react';
import { useAuth } from '../utils/AuthContext';
import {
  subscribeFavorites,
  subscribeCollections,
  setFavorite as setFavoriteDoc,
  removeFavorite as removeFavoriteDoc,
  libraryItemKey,
} from '../services/libraryFirestore';

const LibraryContext = createContext(null);

/**
 * Single Firestore subscription for favorites app-wide (avoids N listeners on game grids).
 */
export function LibraryProvider({ children }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return undefined;
    }
    return subscribeFavorites(setFavorites);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCollections([]);
      return undefined;
    }
    return subscribeCollections(setCollections);
  }, [user]);

  const favoritesSet = useMemo(
    () => new Set(favorites.map((f) => f.id)),
    [favorites],
  );

  const isFavorite = useCallback(
    (kind, refId) => {
      if (!refId) return false;
      return favoritesSet.has(libraryItemKey(kind, refId));
    },
    [favoritesSet],
  );

  const toggleFavorite = useCallback(
    async (kind, refId, meta = {}) => {
      if (!user || !refId) return;
      if (isFavorite(kind, refId)) {
        await removeFavoriteDoc(kind, refId);
      } else {
        await setFavoriteDoc(kind, refId, meta);
      }
    },
    [user, isFavorite],
  );

  const value = useMemo(
    () => ({
      favorites,
      favoritesSet,
      collections,
      collectionCount: collections.length,
      isFavorite,
      toggleFavorite,
      libraryItemKey,
    }),
    [favorites, favoritesSet, collections, isFavorite, toggleFavorite],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error('useLibrary must be used within LibraryProvider');
  }
  return ctx;
}

/** Safe for optional use outside provider (e.g. tests) — returns null if missing. */
export function useLibraryOptional() {
  return useContext(LibraryContext);
}
