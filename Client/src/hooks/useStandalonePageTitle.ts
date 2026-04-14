import { useEffect } from 'react';
import { STANDALONE_META_EVENT } from '../standalone/constants';

export interface StandaloneMetaDetail {
  title: string;
}

/**
 * Updates the standalone toolbar label when `?mode=window` is active.
 */
export function useStandalonePageTitle(title: string | undefined, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !title?.trim()) return;
    const detail: StandaloneMetaDetail = { title: title.trim() };
    window.dispatchEvent(new CustomEvent(STANDALONE_META_EVENT, { detail }));
    return () => {
      window.dispatchEvent(new CustomEvent(STANDALONE_META_EVENT, { detail: { title: 'Fluxy' } }));
    };
  }, [enabled, title]);
}
