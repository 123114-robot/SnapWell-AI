import { Fragment, useEffect, useRef, useState } from 'react'
import { useAppState } from '../state/useAppState.js'
import { buildChatContext, packRecipe } from '../chat/chatContext.js'
import { askChat, CHAT_ERRORS } from '../chat/chatService.js'
import { verifyChatAnswer } from '../chat/chatGuard.js'
import {
  AI_GENERATED_NOTE,
  ALLOW_GENERAL_FOOD_KNOWLEDGE,
  APP_ANSWER_NOTE,
  detectHealthTopic,
  HEALTH_REFUSAL,
  shouldShowAiNote,
} from '../chat/chatPolicy.js'
import { CHAT_STAGES, STAGE_COPY, suggestionsFor } from '../chat/chatStages.js'
import { createChatToolbox, TOOL_LABELS, TOOL_NAMES, visibleRecipes } from '../chat/chatTools.js'

const T = {
  bg: '#FFFFFF', ink: '#0A0A0A', sub: '#6E6E73', faint: '#86868B',
  green: '#1B4332', line: '#E5E5E7', fill: '#F5F5F7',
  tomato: '#C6492B', warnFill: '#FBEAE5', amber: '#E9A824',
}

const ERROR_TEXT = {
  [CHAT_ERRORS.NO_KEY]: 'The online service is not available right now. Please try again later.',
  [CHAT_ERRORS.TIMEOUT]: 'The assistant took too long to answer. Please try again.',
  [CHAT_ERRORS.NETWORK]: 'Could not reach the online service. Check your connection and try again.',
  [CHAT_ERRORS.BAD_RESPONSE]: 'The assistant returned something the app could not read. Please try again.',
}

/**
 * The nutrition cards for one answer, taken from that turn's nutrition tool
 * results. A card appears only when the question actually led to a nutrition
 * lookup, and it keeps the figures from that moment: a later recommendation
 * list — even a regenerated recipe reusing the same id — never changes an
 * answer already on screen.
 */
function nutritionCards(toolCalls, citedRecipeIds) {
  const cards = new Map()
  for (const call of toolCalls) {
    const result = call?.result
    if (call?.name !== TOOL_NAMES.GET_RECIPE_NUTRITION || !result?.available || !result.per_serving) continue
    if (cards.has(result.recipe_id)) continue
    cards.set(result.recipe_id, {
      recipeId: result.recipe_id,
      name: result.name,
      perServing: result.per_serving,
      unresolved: (Array.isArray(result.unresolved_ingredients) ? result.unresolved_ingredients : [])
        .map((label) => String(label).replace(/_/g, ' ')),
      estimated: Boolean(result.note),
    })
  }
  const all = [...cards.values()]
  const cited = all.filter((card) => citedRecipeIds.includes(card.recipeId))
  return cited.length > 0 ? cited : all
}

function NutritionStrip({ cards }) {
  if (!cards?.length) return null

  return (
    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
      {cards.map((card) => {
        const n = card.perServing
        const cells = [
          ['kcal', Math.round(n.kcal)],
          ['protein', `${Number(n.protein_g).toFixed(1)} g`],
          ['carbs', `${Number(n.carbs_g).toFixed(1)} g`],
          ['fat', `${Number(n.fat_g).toFixed(1)} g`],
        ]
        const notes = [
          card.estimated && 'Estimated from your list quantities',
          card.unresolved.length > 0 && `${card.unresolved.join(', ')} not counted`,
        ].filter(Boolean)
        return (
          <div key={card.recipeId} style={{
            border: `1px solid ${T.line}`, borderRadius: 2, padding: '8px 10px', background: T.bg,
          }}>
            <div style={{
              fontSize: 10, color: T.faint, textTransform: 'uppercase',
              letterSpacing: 0.5, marginBottom: 6,
            }}>
              {card.name} · per serving · AUSNUT
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
            {notes.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10.5, color: T.faint, lineHeight: 1.4 }}>
                {notes.join(' · ')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Which of the app's own functions backed this answer. It makes the tool layer
 * visible: the user sees that a figure or an allergy check came from SnapWell,
 * not from the model's memory.
 */
function ToolTrail({ toolsUsed, verifiedNumbers }) {
  if (!toolsUsed?.length) return null
  const labels = [...new Set(toolsUsed.map((name) => TOOL_LABELS[name] ?? name))]
  return (
    <div style={{
      marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5,
      fontSize: 11, color: T.faint, lineHeight: 1.4,
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.green}
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 1 }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>
        Checked with {labels.join(', ')}
        {verifiedNumbers > 0 && ` · ${verifiedNumbers} figure${verifiedNumbers === 1 ? '' : 's'} verified`}
      </span>
    </div>
  )
}

/**
 * Where an answer came from, when that is not SnapWell's verified data: the
 * model's own knowledge, or the app answering in the model's place.
 */
function SourceNote({ text }) {
  return (
    <div style={{
      marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 5,
      fontSize: 11, color: T.faint, lineHeight: 1.4,
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span>{text}</span>
    </div>
  )
}

/** Marks where the conversation moved to another part of the app. */
function StageDivider({ stage }) {
  const rule = <span style={{ flex: 1, height: 1, background: T.line }} />
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 10.5, color: T.faint, textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {rule}
      Now helping with {STAGE_COPY[stage]?.label ?? 'this screen'}
      {rule}
    </div>
  )
}

/**
 * The page's starter questions, one tap from being sent. They stay above the
 * input for the whole conversation, so a user arriving on a new screen mid-chat
 * still sees what can be asked there.
 */
function SuggestionRow({ suggestions, disabled, onPick }) {
  if (suggestions.length === 0) return null
  return (
    <div role="group" aria-label="Suggested questions" style={{
      display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 12px 0',
      scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
    }}>
      {suggestions.map((text) => (
        <button key={text} type="button" disabled={disabled} onClick={() => onPick(text)} style={{
          flex: '0 0 auto', whiteSpace: 'nowrap',
          background: T.bg, border: `1px solid ${T.line}`, borderRadius: 2,
          padding: '7px 10px', fontFamily: 'inherit', fontSize: 12.5,
          color: disabled ? T.faint : T.ink, cursor: disabled ? 'default' : 'pointer',
        }}>{text}</button>
      ))}
    </div>
  )
}

function Bubble({ message }) {
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

  // A withheld reply says why it was withheld, so the verification layer is
  // visible rather than implied. A failed request is a different thing — the
  // guard never saw a reply — and is labelled as such.
  if (message.kind === 'blocked' || message.kind === 'error') {
    return (
      <div style={{
        background: T.warnFill, border: `1px solid ${T.tomato}`, borderRadius: 2,
        padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: T.tomato, maxWidth: '92%',
      }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>
          {message.kind === 'error' ? 'Could not answer' : 'Withheld'}
        </strong>
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
      <ToolTrail toolsUsed={message.toolsUsed} verifiedNumbers={message.verifiedNumbers} />
      {message.aiGenerated && <SourceNote text={AI_GENERATED_NOTE} />}
      {message.answeredByApp && <SourceNote text={APP_ANSWER_NOTE} />}
      <NutritionStrip cards={message.nutritionCards} />
    </div>
  )
}

export default function ChatDrawer({
  open,
  onClose,
  stage = CHAT_STAGES.RECIPES,
  page = null,
  focusedRecipeId = null,
}) {
  const {
    ingredients,
    preferences,
    recommendationResult,
    selectedRecipe,
    chatMessages: messages,
    setChatMessages: setMessages,
  } = useAppState()
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const abortRef = useRef(null)
  const listRef = useRef(null)
  const copy = STAGE_COPY[stage] ?? STAGE_COPY[CHAT_STAGES.RECIPES]

  // Closing the drawer should not leave a request running against the app's
  // API quota. The conversation itself lives in app state, so it is still here
  // when the drawer reopens — on this screen or another.
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
    setMessages((prev) => [...prev, { role: 'user', text: question, stage }])

    // A health question never reaches the model: the app answers it itself,
    // without spending a request on a reply that could only be refused
    if (detectHealthTopic(question)) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        kind: 'answer',
        stage,
        text: HEALTH_REFUSAL,
        answeredByApp: true,
      }])
      return
    }

    setPending(true)

    const controller = new AbortController()
    abortRef.current = controller

    const context = buildChatContext({
      stage,
      ingredients,
      preferences,
      recommendationResult,
      focusedRecipeId,
    })
    const toolbox = createChatToolbox({ stage, recommendationResult, preferences, ingredients })

    // Withheld replies, errors and the app's own answers are not the assistant
    // talking, so they stay out of what the model is told it said
    const history = messages
      .filter((m) => m.role === 'user' || (m.kind === 'answer' && !m.answeredByApp))
      .map((m) => ({ role: m.role, text: m.text }))
    const result = await askChat({ question, context, history, toolbox, signal: controller.signal })

    if (controller.signal.aborted) return
    abortRef.current = null

    if (!result.success) {
      // Meaningless in the chat, but kept in the console so an unreadable
      // reply can be traced to what the model actually sent
      if (result.detail) console.warn('[SnapWell assistant] unusable reply', result.errorKind, result.detail)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        kind: 'error',
        stage,
        text: ERROR_TEXT[result.errorKind] ?? ERROR_TEXT[CHAT_ERRORS.NETWORK],
      }])
      setPending(false)
      return
    }

    // Nothing the model returned reaches the screen before this runs.
    const toolCalls = result.toolCalls ?? []
    const verdict = verifyChatAnswer({
      answer: result.answer,
      context,
      allowedRecipeIds: toolbox.allowedRecipeIds(),
      recipeNames: toolbox.recipeNames(),
      toolCalls,
    })

    setMessages((prev) => [...prev, verdict.status === 'ok'
      ? {
        role: 'assistant',
        kind: 'answer',
        stage,
        text: verdict.text,
        citedRecipeIds: verdict.citedRecipeIds,
        redactedNumbers: verdict.redactedNumbers,
        verifiedNumbers: verdict.verifiedNumbers,
        toolsUsed: toolCalls.map((call) => call.name),
        nutritionCards: nutritionCards(toolCalls, verdict.citedRecipeIds),
        answeredByApp: Boolean(verdict.answeredByApp),
        aiGenerated: shouldShowAiNote({
          generalKnowledge: verdict.generalKnowledge,
          declined: verdict.declined,
          answeredByApp: verdict.answeredByApp,
          toolCallCount: toolCalls.length,
        }),
      }
      : {
        role: 'assistant',
        kind: 'blocked',
        stage,
        text: verdict.message,
        reason: verdict.reason,
      }])
    setPending(false)
  }

  if (!open) return null

  const listRecipes = visibleRecipes(recommendationResult).map(packRecipe)
  const introCount = stage === CHAT_STAGES.INGREDIENTS ? ingredients.length : listRecipes.length
  const lastStage = messages.at(-1)?.stage
  const focusedName = focusedRecipeId
    ? (listRecipes.find((recipe) => recipe.recipe_id === String(focusedRecipeId))?.name
      ?? (String(selectedRecipe?.id) === String(focusedRecipeId) ? selectedRecipe?.name : null))
    : null
  const suggestions = suggestionsFor(page, focusedName)

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
                SnapWell assistant
              </div>
              <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>
                {copy.subtitle} · your photos stay on this device
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
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.55 }}>
              {copy.intro(introCount)}
              {ALLOW_GENERAL_FOOD_KNOWLEDGE
                && ' You can also ask general cooking questions — those answers come from AI, so please double-check them.'}
            </div>
          )}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const moved = message.role === 'user' && previous?.stage && message.stage !== previous.stage
            return (
              <Fragment key={index}>
                {moved && <StageDivider stage={message.stage} />}
                <Bubble message={message} />
              </Fragment>
            )
          })}

          {messages.length > 0 && lastStage && lastStage !== stage && !pending && (
            <StageDivider stage={stage} />
          )}

          {pending && (
            <div style={{ fontSize: 13, color: T.faint }}>Thinking…</div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
          <SuggestionRow suggestions={suggestions} disabled={pending} onPick={send} />

          <div style={{
            padding: '10px 12px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
            display: 'flex', gap: 8,
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
              placeholder={copy.placeholder}
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
      </div>
    </>
  )
}
