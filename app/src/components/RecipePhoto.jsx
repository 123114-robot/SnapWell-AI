import { useState } from 'react'

export default function RecipePhoto({ src, name, eager = false }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const visible = src && failedSrc !== src
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {visible && <img src={src} alt={`AI illustration of ${name}`}
        loading={eager ? 'eager' : 'lazy'} decoding="async"
        onError={() => setFailedSrc(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent 70%)' }} />
      {visible
        ? <span style={{ position: 'absolute', top: 48, right: 12, padding: '3px 7px',
          borderRadius: 2, background: 'rgba(255,255,255,0.92)', color: '#1B4332',
          fontSize: 10, fontWeight: 600 }}>AI illustration</span>
        : <span style={{ position: 'absolute', top: 72, left: 16, color: '#fff',
          opacity: 0.8, fontSize: 12 }}>Illustration not available</span>}
    </div>
  )
}
