import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../state/useAppState.js'
import { buildChatContext } from '../chat/chatContext.js'
import { askChat, CHAT_ERRORS } from '../chat/chatService.js'
import { verifyChatAnswer } from '../chat/chatGuard.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
  tomato: '#C6492B', warnFill: '#FBEAE5', amber: '#E9A824',
}

const ERROR_TEXT = {
  [CHAT_ERRORS.TIMEOUT]: 'The assistant took too long to answer. Please try again.',
  [CHAT_ERRORS.NETWORK]: 'Could not reach the online service. Check your connection and try again.',
  [CHAT_ERRORS.BAD_RESPONSE]: 'The assistant returned something the app could not read. Please try again.',
}

const SUGGESTIONS = [
  'Why was this recipe suggested?',
  'What can I cook without shopping?',
  'How do I make this one?',
]

/**
 * Per-serving figures for a recipe the assistant cited, read from the context
 * pack the app built from AUSNUT data. The model is told never to state a
 * number; these are what the user sees instead, so the figure on screen is
 * always the app's own, never the model's.
 */
function NutritionStrip({ context, recipeIds }) {
  const recipes = (context?.candidate_recipes ?? []).filter(
    (recipe) => recipeIds.includes(recipe.recipe_id) && recipe.nutrition_available,
  )
  if (recipes.length === 0) return null

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      {recipes.map((recipe) => {
        const n = recipe.nutrition_per_serving
        const cells = [
          ['kcal', Math.round(n.kcal)],
          ['protein', `${n.protein_g.toFixed(1)} g`],
          ['carbs', `${n.carbs_g.toFixed(1)} g`],
          ['fat', `${n.fat_g.toFixed(1)} g`],
        ]
        return (
          <div key={recipe.recipe_id} style={{
            border: `1px solid ${T.line}`, borderRadius: 2, padding: '8px 10px', background: T.bg,
          }}>
            <div style={{
              fontSize: 10, color: T.faint, textTransform: 'uppercase',
              letterSpacing: 0.5, marginBottom: 6,
            }}>
              {recipe.name} · per serving · AUSNUT
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {cells.map(([label, value]) => (
                <div key={label}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: T.ink,
                    fontFamily: 'ui-monospace, monospace',
                  }}>{value}</div>
                  <div style={{ fontSize: 10, color: T.faint }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Bubble({ message, context }) {
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: T.green, color: '#fff', borderRadius: 2,
          padding: '10px 12px', fontSize: 14, lineHeight: 1.5, maxWidth: '84%',
        }}>
          {message.text}
        </div>
      </div>
    )
  }

  // A withheld reply says why it was withheld. The user is told which rule
  // fired, and in a demo the verification layer is visible rather than implied.
  if (message.kind === 'blocked' || message.kind === 'error') {
    return (
      <div style={{
        background: T.warnFill, border: `1px solid ${T.tomato}`, borderRadius: 2,
        padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: T.tomato, maxWidth: '92%',
      }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Withheld</strong>
        {message.text}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '92%' }}>
      <div style={{
        background: T.fill, borderRadius: 2, padding: '10px 12px',
        fontSize: 14, lineHeight: 1.55, color: T.ink, whiteSpace: 'pre-wrap',
      }}>
        {message.text}
      </div>
      <NutritionStrip context={context} recipeIds={message.citedRecipeIds ?? []} />
    </div>
  )
}

function MissingKeyNotice({ onGoToSettings }) {
  return (
    <div style={{
      background: T.fill, border: `1px solid ${T.amber}`, borderRadius: 2,
      padding: '12px 14px', fontSize: 13, lineHeight: 1.55, color: T.ink,
    }}>
      <strong style={{ display: 'block', marginBottom: 4 }}>Add your Gemini API key</strong>
      SnapWell does not ship an API key of its own. Add your own key in Settings and it
      stays in this browser only.
      <div style={{ marginTop: 10 }}>
        <button type="button" onClick={onGoToSettings} style={{
          background: T.green, color: '#fff', border: 'none', borderRadius: 2,
          padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
          fontWeight: 600, fontSize: 13,
        }}>Open Settings</button>
      </div>
    </div>
  )
}

export default function ChatDrawer({ open, onClose, focusedRecipeId = null }) {
  const navigate = useNavigate()
  const { ingredients, preferences, recommendationResult } = useAppState()
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const abortRef = useRef(null)
  const listRef = useRef(null)

  // Closing the drawer should not leave a request running against the user's
  // own API quota. The component itself stays mounted, so the conversation is
  // still here when they reopen it.
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
      setPending(false)
    }
  }, [open])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, messages, pending])

  async function send(questionText) {
    const question = String(questionText ?? '').trim()
    if (!question || pending) return

    setDraft('')
    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setPending(true)

    const controller = new AbortController()
    abortRef.current = controller

    const context = buildChatContext({
      ingredients,
      preferences,
      recommendationResult,
      focusedRecipeId,
    })

    const history = messages.map((m) => ({ role: m.role, text: m.text }))
    const result = await askChat({ question, context, history, signal: controller.signal })

    if (controller.signal.aborted) return
    abortRef.current = null

    if (!result.success) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        kind: result.errorKind === CHAT_ERRORS.NO_KEY ? 'no_key' : 'error',
        text: ERROR_TEXT[result.errorKind] ?? ERROR_TEXT[CHAT_ERRORS.NETWORK],
      }])
      setPending(false)
      return
    }

    // Nothing the model returned reaches the screen before this runs.
    const verdict = verifyChatAnswer({ answer: result.answer, context })

    setMessages((prev) => [...prev, verdict.status === 'ok'
      ? {
        role: 'assistant',
        kind: 'answer',
        text: verdict.text,
        citedRecipeIds: verdict.citedRecipeIds,
        redactedNumbers: verdict.redactedNumbers,
      }
      : {
        role: 'assistant',
        kind: 'blocked',
        text: verdict.message,
        reason: verdict.reason,
      }])
    setPending(false)
  }

  if (!open) return null

  const context = buildChatContext({
    ingredients,
    preferences,
    recommendationResult,
    focusedRecipeId,
  })
  const needsKey = messages.some((m) => m.kind === 'no_key')

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.35)', zIndex: 80,
        }}
      />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 81,
        maxWidth: 430, margin: '0 auto', height: '72vh',
        background: T.bg, borderTop: `1px solid ${T.line}`,
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          padding: '14px 16px 10px', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>
                Recipe assistant
              </div>
              <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>
                Chat uses online AI · your photos stay on this device
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{
              width: 32, height: 32, display: 'grid', placeItems: 'center',
              background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2,
              cursor: 'pointer', color: T.ink, flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={listRef} style={{
          flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid',
          gap: 12, alignContent: 'start',
        }}>
          {messages.length === 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55 }}>
                Ask about the {context.candidate_recipes.length} recipe
                {context.candidate_recipes.length === 1 ? '' : 's'} on your list. The
                assistant only answers within them.
              </div>
              {SUGGESTIONS.map((text) => (
                <button key={text} type="button" onClick={() => send(text)} style={{
                  textAlign: 'left', background: T.bg, border: `1px solid ${T.line}`,
                  borderRadius: 2, padding: '9px 11px', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13, color: T.ink,
                }}>{text}</button>
              ))}
            </div>
          )}

          {messages.map((message, index) => (
            message.kind === 'no_key'
              ? <MissingKeyNotice key={index} onGoToSettings={() => navigate('/preferences')} />
              : <Bubble key={index} message={message} context={context} />
          ))}

          {pending && (
            <div style={{ fontSize: 13, color: T.faint }}>Thinking…</div>
          )}
        </div>

        <div style={{
          borderTop: `1px solid ${T.line}`, padding: '10px 12px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send(draft)
              }
            }}
            placeholder={needsKey ? 'Add your API key in Settings first' : 'Ask about these recipes…'}
            style={{
              flex: 1, border: `1px solid ${T.line}`, borderRadius: 2,
              padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
              color: T.ink, outline: 'none', minWidth: 0,
            }}
          />
          <button
            type="button"
            onClick={() => send(draft)}
            disabled={pending || !draft.trim()}
            style={{
              background: pending || !draft.trim() ? T.line : T.green,
              color: pending || !draft.trim() ? T.faint : '#fff',
              border: 'none', borderRadius: 2, padding: '10px 16px',
              cursor: pending || !draft.trim() ? 'default' : 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: 14, flexShrink: 0,
            }}
          >Send</button>
        </div>
      </div>
    </>
  )
}
