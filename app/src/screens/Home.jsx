import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'

// 全 app 统一配色：纯白 + 中性灰 + 深绿点睛（近直角，苹果字体）
const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7', tomato: '#C6492B',
}

const EMOJI = {
  apple: '🍎', banana: '🍌', orange: '🍊', tomato: '🍅', carrot: '🥕',
  broccoli: '🥦', milk: '🥛', egg: '🥚', bread: '🍞', cheese: '🧀',
  pasta: '🍝', rice: '🍚', chicken: '🍗', fish: '🐟', potato: '🥔',
  onion: '🧅', garlic: '🧄', lemon: '🍋',
}
const emojiFor = (label) => EMOJI[String(label).toLowerCase()] || '🥗'

export default function Home() {
  const navigate = useNavigate()
  const { ingredients } = useAppState()
  const recent = Array.isArray(ingredients) ? ingredients.slice(0, 6) : []

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      maxWidth: 430, margin: '0 auto', paddingBottom: 30,
    }}>
      {/* 顶部品牌 + 隐私标识 */}
      <div style={{ padding: '24px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 2, background: T.green,
            display: 'grid', placeItems: 'center', color: '#fff',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 5.8L20 10.7l-5.8 1.9L12 18l-1.9-5.4L4 10.7l6.1-1.9z" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 21, color: T.ink, letterSpacing: -0.4 }}>SnapWell</span>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: T.fill, color: T.sub, fontWeight: 600,
          fontSize: 11, padding: '5px 9px', borderRadius: 2,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.green}
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
          </svg>
          On-device
        </span>
      </div>

      {/* 主标题（强字体对比） */}
      <div style={{ padding: '28px 20px 0' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: T.ink, letterSpacing: -0.9, lineHeight: 1.08 }}>
          Cook with what<br />you already have
        </div>
        <p style={{ fontSize: 15, color: T.sub, marginTop: 12, lineHeight: 1.5, maxWidth: 300 }}>
          Snap your ingredients — recipes matched to Australian kitchens, all on your device.
        </p>
      </div>

      {/* 主 CTA 按钮（直角深绿） */}
      <div style={{ padding: '24px 20px 0' }}>
        <button onClick={() => navigate('/capture')} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          background: T.green, color: '#fff', border: 'none', borderRadius: 2,
          padding: '16px 18px', fontFamily: 'inherit', fontWeight: 600, fontSize: 16, cursor: 'pointer',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Snap ingredients
        </button>
      </div>

      {/* 最近识别的食材 */}
      <div style={{ padding: '36px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.faint, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Recently detected
          </span>
          {recent.length > 0 && (
            <button onClick={() => navigate('/confirm')} style={{
              background: 'none', border: 'none', color: T.green, fontFamily: 'inherit',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>View all</button>
          )}
        </div>
        {recent.length === 0 ? (
          <div style={{
            background: T.fill, border: `1px solid ${T.line}`, borderRadius: 2,
            padding: 20, textAlign: 'center', color: T.faint, fontSize: 13.5,
          }}>
            Nothing yet — snap a photo to detect your ingredients.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {recent.map((it, i) => (
              <div key={it.id ?? i} style={{
                flex: '0 0 auto', width: 76, background: T.bg, border: `1px solid ${T.line}`,
                borderRadius: 2, padding: '14px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28 }}>{emojiFor(it.label)}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: T.ink, marginTop: 6, textTransform: 'capitalize',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 推荐食谱入口 */}
      <div style={{ padding: '32px 20px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.faint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
          For you
        </div>
        <button onClick={() => navigate('/recommendations')} style={{
          width: '100%', textAlign: 'left', background: T.bg, border: `1px solid ${T.line}`,
          borderRadius: 2, padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 2, background: T.green,
            display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: T.ink }}>See recipe matches</div>
            <div style={{ fontSize: 12.5, color: T.sub, marginTop: 2 }}>
              Recipes ranked by what you have
            </div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.faint}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* 三步说明 */}
      <div style={{ padding: '32px 20px 0' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.faint,
          textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16,
        }}>How it works</div>
        <div style={{ display: 'grid', gap: 14 }}>
          {[
            ['1', 'Snap or upload a photo of your ingredients'],
            ['2', 'Review what we detected — edit anything'],
            ['3', 'Get recipes matched to what you have'],
          ].map(([n, text]) => (
            <div key={n} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 2, background: T.fill,
                color: T.ink, fontWeight: 600, fontSize: 13,
                display: 'grid', placeItems: 'center', flexShrink: 0,
                fontFamily: 'ui-monospace, monospace',
              }}>{n}</div>
              <span style={{ fontSize: 14, color: T.ink }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}