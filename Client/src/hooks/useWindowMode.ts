import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { STANDALONE_MODE_PARAM, STANDALONE_MODE_VALUE } from '../standalone/constants';

export function useWindowMode(): boolean {
  const [params] = useSearchParams();
  return useMemo(
    () => params.get(STANDALONE_MODE_PARAM) === STANDALONE_MODE_VALUE,
    [params],
  );
}
