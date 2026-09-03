import { createContext, useContext } from 'react'

/**
 * The app-wide store's context and constants live here, separate from the
 * provider component, so neither file mixes component and non-component
 * exports. Vite's fast refresh only works on modules that export components
 * alone.
 */
export const AppCtx = createContext(null)

export const useAppState = () => useContext(AppCtx)

/**
 * Lifecycle of one detection run. The Processing screen waits on this instead
 * of on a fixed timer, so a slow phone never lands the user on the confirm
 * screen before the detector has produced anything.
 */
export const DETECTION_IDLE = { status: 'idle', error: null }
export const DETECTION_RUNNING = { status: 'running', error: null }
export const DETECTION_DONE = { status: 'done', error: null }
