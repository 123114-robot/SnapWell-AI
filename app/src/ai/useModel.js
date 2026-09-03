import { createContext, useContext } from 'react'

/** Detector session context, kept apart from ModelProvider for fast refresh. */
export const ModelCtx = createContext(null)

export const useModel = () => useContext(ModelCtx)
