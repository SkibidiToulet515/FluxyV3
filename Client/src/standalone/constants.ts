/** Query key for compact standalone chrome (toolbar only). */
export const STANDALONE_MODE_PARAM = 'mode' as const;

/** Value that activates standalone chrome. */
export const STANDALONE_MODE_VALUE = 'window' as const;

export const STANDALONE_WINDOW_NAME = 'fluxy-standalone' as const;

/** Dispatched by pages to update the standalone toolbar title. */
export const STANDALONE_META_EVENT = 'fluxy:standalone-meta' as const;

export const STANDALONE_PREFS_KEY = 'fluxy-standalone-prefs' as const;
