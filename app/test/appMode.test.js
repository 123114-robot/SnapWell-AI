import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APP_MODES,
  APP_MODE_STORAGE_KEY,
  DEFAULT_APP_MODE,
  ONLINE_CONSENT_STORAGE_KEY,
  ONLINE_CONSENT_VERSION,
  hasOnlineConsent,
  isOnlineMode,
  normaliseAppMode,
  readStoredAppMode,
  saveOnlineConsent,
  saveStoredAppMode,
  switchedToOnline,
} from '../src/state/appMode.js'

function withWindow(fakeWindow, run) {
  const previous = globalThis.window
  globalThis.window = fakeWindow
  try {
    return run()
  } finally {
    if (previous === undefined) delete globalThis.window
    else globalThis.window = previous
  }
}

function withStorage(initial, run) {
  const store = new Map(Object.entries(initial))
  const localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  }
  return withWindow({ localStorage }, () => run(store))
}

const blockedWindow = {
  get localStorage() {
    throw new Error('blocked')
  },
}

test('Local mode is the default when nothing is stored', () => {
  assert.equal(DEFAULT_APP_MODE, APP_MODES.LOCAL)
  withStorage({}, () => {
    assert.equal(readStoredAppMode(), APP_MODES.LOCAL)
  })
})

test('Anything other than an explicit Online choice reads as Local mode', () => {
  for (const value of [null, undefined, '', 'Online', 'ai', 'private', 42]) {
    assert.equal(normaliseAppMode(value), APP_MODES.LOCAL)
  }
  assert.equal(normaliseAppMode('online'), APP_MODES.ONLINE)

  withStorage({ [APP_MODE_STORAGE_KEY]: 'something-else' }, () => {
    assert.equal(readStoredAppMode(), APP_MODES.LOCAL)
  })
})

test('A saved mode is read back after a reload', () => {
  withStorage({}, store => {
    assert.equal(saveStoredAppMode(APP_MODES.ONLINE), true)
    assert.equal(store.get(APP_MODE_STORAGE_KEY), 'online')
    assert.equal(isOnlineMode(readStoredAppMode()), true)

    assert.equal(saveStoredAppMode(APP_MODES.LOCAL), true)
    assert.equal(isOnlineMode(readStoredAppMode()), false)
  })
})

test('The Online notice is remembered once accepted', () => {
  withStorage({}, store => {
    assert.equal(hasOnlineConsent(), false)
    assert.equal(saveOnlineConsent(), true)
    assert.equal(store.get(ONLINE_CONSENT_STORAGE_KEY), ONLINE_CONSENT_VERSION)
    assert.equal(hasOnlineConsent(), true)
  })
})

test('Consent to an older notice version asks again', () => {
  withStorage({ [ONLINE_CONSENT_STORAGE_KEY]: 'outdated' }, () => {
    assert.equal(hasOnlineConsent(), false)
  })
})

test('Only a move from Local to Online counts as turning Online mode on', () => {
  assert.equal(switchedToOnline(APP_MODES.LOCAL, APP_MODES.ONLINE), true)
  assert.equal(switchedToOnline(APP_MODES.ONLINE, APP_MODES.ONLINE), false)
  assert.equal(switchedToOnline(APP_MODES.ONLINE, APP_MODES.LOCAL), false)
  assert.equal(switchedToOnline(APP_MODES.LOCAL, APP_MODES.LOCAL), false)
})

test('Blocked storage falls back to Local mode and no consent instead of throwing', () => {
  withWindow(blockedWindow, () => {
    assert.equal(readStoredAppMode(), APP_MODES.LOCAL)
    assert.equal(saveStoredAppMode(APP_MODES.ONLINE), false)
    assert.equal(hasOnlineConsent(), false)
    assert.equal(saveOnlineConsent(), false)
  })
})
