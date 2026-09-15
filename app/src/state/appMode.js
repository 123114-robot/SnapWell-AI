/**
 * The two ways SnapWell can run.
 *
 * Local mode is the proposal's promise kept whole: recognition, matching and
 * nutrition all run on this device, and recipes come only from the built-in
 * recipe book. Online mode adds the features that need Google Gemini — AI chat
 * and generated recipe recommendations.
 */
export const APP_MODES = Object.freeze({
  LOCAL: 'local',
  ONLINE: 'online',
})

export const DEFAULT_APP_MODE = APP_MODES.LOCAL

export const APP_MODE_STORAGE_KEY = 'SNAPWELL_APP_MODE'

export const ONLINE_CONSENT_STORAGE_KEY = 'SNAPWELL_ONLINE_CONSENT'

/**
 * Bump this when Online mode starts sending something new, so everyone who
 * agreed to the old notice is shown the new one once.
 */
export const ONLINE_CONSENT_VERSION = '1'

/**
 * Anything that is not an explicit Online choice reads as Local mode, so a
 * corrupted or unfamiliar stored value can never switch the network on.
 */
export function normaliseAppMode(value) {
  return value === APP_MODES.ONLINE ? APP_MODES.ONLINE : APP_MODES.LOCAL
}

export function isOnlineMode(mode) {
  return mode === APP_MODES.ONLINE
}

/**
 * Whether a mode change turned Online mode on. The chat button makes its
 * entrance only then, not when the app simply opens in Online mode.
 */
export function switchedToOnline(previousMode, nextMode) {
  return !isOnlineMode(previousMode) && isOnlineMode(nextMode)
}

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    // Private browsing and blocked site data both throw on access
    return null
  }
}

export function readStoredAppMode() {
  try {
    return normaliseAppMode(storage()?.getItem(APP_MODE_STORAGE_KEY))
  } catch {
    return DEFAULT_APP_MODE
  }
}

export function saveStoredAppMode(mode) {
  try {
    const store = storage()
    if (!store) return false
    store.setItem(APP_MODE_STORAGE_KEY, normaliseAppMode(mode))
    return true
  } catch {
    return false
  }
}

export function hasOnlineConsent() {
  try {
    return storage()?.getItem(ONLINE_CONSENT_STORAGE_KEY) === ONLINE_CONSENT_VERSION
  } catch {
    return false
  }
}

export function saveOnlineConsent() {
  try {
    const store = storage()
    if (!store) return false
    store.setItem(ONLINE_CONSENT_STORAGE_KEY, ONLINE_CONSENT_VERSION)
    return true
  } catch {
    return false
  }
}
