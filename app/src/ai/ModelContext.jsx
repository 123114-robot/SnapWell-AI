import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createSession, warmUp } from './detector.js'

const ModelCtx = createContext(null)

export function ModelProvider({ children }) {
  const sessionRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    createSession('/models/yolov8n.onnx', (p) => !cancelled && setProgress(p))
      .then(async (s) => {
        if (cancelled) return
        sessionRef.current = s
        setStatus('warming')
        await warmUp(s)
        if (!cancelled) setStatus('ready')
      })
      .catch((e) => { if (!cancelled) { setError(e); setStatus('error') } })
    return () => { cancelled = true }
  }, [])

  return (
    <ModelCtx.Provider value={{ session: sessionRef, status, progress, error }}>
      {children}
    </ModelCtx.Provider>
  )
}

export const useModel = () => useContext(ModelCtx)
