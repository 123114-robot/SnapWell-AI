export const CHAT_MODEL = 'gemini-3.5-flash-lite'
export const DEFAULT_CHAT_TIMEOUT_MS = 30000
export const MAX_HISTORY_TURNS = 6

/**
 * Where the user's own Gemini key lives.
 *
 * Deliberately NOT a VITE_ environment variable: Vite inlines those into the
 * bundle at build time, so a key placed there is readable by anyone who opens
 * the deployed JavaScript. SnapWell ships no key of its own — each user brings
 * their own, it stays in their browser, and it is never bundled or committed.
 *
 * The name matches the fallback the existing recommendation service already
 * reads, so one field in Settings powers both features.
 */
export const CHAT_API_KEY_STORAGE_KEY = 'GEMINI_API_KEY'

export const CHAT_ERRORS = Object.freeze({
  NO_KEY: 'no_key',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  BAD_RESPONSE: 'bad_response',
})

const SYSTEM_INSTRUCTION = `You are the in-app assistant for SnapWell AI, a food app that detects ingredients and recommends recipes.

You explain recipes the app has already chosen. You do not choose or invent them.

## What you are given

Each turn includes a JSON context with:
- the ingredients the user confirmed
- the user's dietary preferences and allergens (already normalised, e.g. "no_nuts", "vegan")
- candidate_recipes: the recipes the app's local engine ranked for this user
- focused_recipe_id: the recipe the user is currently looking at, if any
- per-serving nutrition the app calculated from AUSNUT reference data

## Hard rules

1. Answer ONLY about recipes in candidate_recipes. Never invent a recipe, never name a dish that is not in that list, and never describe a recipe from your own knowledge.
2. If the user asks for something no candidate recipe covers, say plainly that you can only discuss the recipes on their list, and suggest the closest one that IS on the list.
3. List every recipe you discuss in cited_recipe_ids, using its exact recipe_id.
4. Never state a nutrition number. The app renders the real AUSNUT figures itself. Refer to the nutrition panel instead of quoting kilojoules, calories, grams of protein or milligrams of sodium.
5. Never suggest an ingredient that conflicts with the user's allergens or dietary pattern, not even as an optional extra or a substitution.
6. If a recipe has nutrition_available set to false, say the app has no nutrition data for it. Do not estimate.
7. Cooking quantities from the recipe itself are fine to mention. Nutrition figures are not.

## Style

Answer in the same language the user wrote in. Two to four sentences. Practical and concrete, no preamble, no bullet lists unless the user asks for steps.

## Output

Return JSON only, exactly this shape:
{"answer": "your reply as plain text", "cited_recipe_ids": ["R001"]}`

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    // Private browsing and blocked site data both throw on access
    return null
  }
}

export function readApiKey() {
  try {
    const value = storage()?.getItem(CHAT_API_KEY_STORAGE_KEY)
    return value ? String(value).trim() : ''
  } catch {
    return ''
  }
}

export function saveApiKey(key) {
  try {
    const value = String(key ?? '').trim()
    if (!value) {
      storage()?.removeItem(CHAT_API_KEY_STORAGE_KEY)
      return true
    }
    storage()?.setItem(CHAT_API_KEY_STORAGE_KEY, value)
    return true
  } catch {
    return false
  }
}

export function clearApiKey() {
  return saveApiKey('')
}

export function hasApiKey() {
  return readApiKey().length > 0
}

/**
 * Recent turns only. The context pack is resent every turn anyway, so older
 * messages add cost without adding grounding.
 */
function historyContents(history) {
  const turns = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : []
  return turns
    .filter(turn => typeof turn?.text === 'string' && turn.text.trim())
    .map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.text }],
    }))
}

function failure(errorKind) {
  return { success: false, errorKind, answer: null }
}

/**
 * One chat turn. Returns the model's parsed reply untouched — verification is
 * the guard's job, and keeping the two apart is what makes the guard testable
 * without a network call.
 */
export async function askChat({
  question,
  context,
  history = [],
  apiKey = null,
  model = CHAT_MODEL,
  timeoutMs = DEFAULT_CHAT_TIMEOUT_MS,
  fetchFn = fetch,
  signal = null,
} = {}) {
  const key = (apiKey && String(apiKey).trim()) || readApiKey()
  if (!key) return failure(CHAT_ERRORS.NO_KEY)

  const text = String(question ?? '').trim()
  if (!text) return failure(CHAT_ERRORS.BAD_RESPONSE)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs)
  const onExternalAbort = () => controller.abort('cancelled')
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        ...historyContents(history),
        {
          role: 'user',
          parts: [{
            text: `Context:\n${JSON.stringify(context)}\n\nUser question:\n${text}`,
          }],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    }

    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) return failure(CHAT_ERRORS.NETWORK)

    const json = await response.json()
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return failure(CHAT_ERRORS.BAD_RESPONSE)

    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return failure(CHAT_ERRORS.BAD_RESPONSE)
    }

    if (!parsed || typeof parsed !== 'object' || typeof parsed.answer !== 'string') {
      return failure(CHAT_ERRORS.BAD_RESPONSE)
    }

    return { success: true, errorKind: null, answer: parsed }
  } catch (error) {
    const aborted = error?.name === 'AbortError' || controller.signal.aborted
    return failure(aborted ? CHAT_ERRORS.TIMEOUT : CHAT_ERRORS.NETWORK)
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}

export { SYSTEM_INSTRUCTION }
