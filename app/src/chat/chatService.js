import { getApiKey } from '../recommendation/geminiService.js'
import { ALLOW_GENERAL_FOOD_KNOWLEDGE } from './chatPolicy.js'
import { CHAT_STAGES, STAGE_PROMPTS } from './chatStages.js'

export const CHAT_MODEL = 'gemini-3.5-flash-lite'
// One turn can take several requests once tools are involved
export const DEFAULT_CHAT_TIMEOUT_MS = 45000
export const MAX_HISTORY_TURNS = 6

/**
 * Tool rounds allowed in one turn before the model must answer. Each round is
 * a request, so this caps both latency and quota; past it the next request
 * turns tools off, and the model answers with what it already has.
 */
export const MAX_TOOL_ROUNDS = 3

/**
 * Extra requests allowed when a reply cannot be read. The model occasionally
 * answers in prose, or with nothing, instead of the JSON it was asked for; one
 * retry recovers that without letting a broken turn run up the quota.
 */
export const MAX_REPAIR_ATTEMPTS = 1

export const CHAT_ERRORS = Object.freeze({
  NO_KEY: 'no_key',
  TIMEOUT: 'timeout',
  NETWORK: 'network',
  BAD_RESPONSE: 'bad_response',
})

const PROMPT_ROLE = 'You are the in-app assistant for SnapWell AI, a food app that detects ingredients and recommends recipes.'

const PROMPT_SCOPE = {
  strict: 'You help the user with their own ingredients and the recipes SnapWell has for them. You do not invent recipes, and you do not answer from general food knowledge.',
  general: 'You help the user with their own ingredients and the recipes SnapWell has for them, and you can also answer general food and cooking questions. SnapWell\'s own data comes first: its recipes, nutrition figures and allergy checks are verified, and your general knowledge is not.',
}

const PROMPT_CONTEXT = `## What you are given

Each turn includes a JSON context with:
- stage: which part of the app the user is in
- the ingredients on the user's list, with quantities
- the user's dietary preferences and allergens (already normalised, e.g. "no_nuts", "vegan")
- candidate_recipes: a summary of the top recipes on the user's list, when there is one
- focused_recipe_id: the recipe the user is currently looking at, if any`

function hardRules(allowGeneral) {
  const rules = [
    allowGeneral
      ? 'When you recommend or describe a SnapWell recipe, use only recipes from candidate_recipes or a tool result — never invent one, and never describe one from memory. Other dishes may come up only as general ideas: say they are ideas rather than SnapWell recipes, and never give nutrition numbers for them.'
      : 'Discuss ONLY recipes that appear in candidate_recipes or in a tool result. Never invent a recipe, and never describe one from your own knowledge.',
    allowGeneral
      ? 'If nothing on the user\'s list covers what they ask for, say so plainly, suggest the closest recipe that IS on the list, and offer general ideas if they help.'
      : 'If nothing available covers what the user asks for, say so plainly and suggest the closest recipe that IS available.',
    'List every SnapWell recipe you discuss in cited_recipe_ids, using its exact recipe_id. In the answer text, refer to recipes by name only — never write a recipe_id there.',
    'Nutrition figures may come only from get_recipe_nutrition or get_list_nutrition. Quote them exactly as returned, with their units, and say what they cover: per serving, or the whole list. If you have not called one of them, do not state any nutrition number.',
    'If a nutrition tool says data is unavailable, say the app has no nutrition data for it. If it says partial, say some ingredients are not counted. Never estimate.',
    'Call check_ingredient only when you propose an ingredient of your own — an extra, a topping or a substitute that is not already on the user\'s list or in a SnapWell recipe — and the user has allergens or a dietary pattern set. Suggest it only if the result has allowed true and verified true. Ingredients a SnapWell recipe already lists need no check, and suggest_additions checks its own entries: suggest only those with verified_safe true.',
    allowGeneral
      ? 'Call a tool only when the answer depends on SnapWell\'s data — the user\'s recipes, ingredients, nutrition, allergy rules, or how the app itself works. General cooking questions, questions you decline, and anything off-topic need no tool call.'
      : 'Call a tool only when the answer depends on SnapWell\'s data. Questions you decline need no tool call.',
    'Describe SnapWell\'s own screens, features and data handling only from get_app_help. If the guide does not cover something, say SnapWell does not offer it as far as you know — never guess about the app.',
  ]

  if (allowGeneral) {
    rules.push(
      'You may answer general food and cooking questions from your own knowledge: storing and preparing ingredients, cooking techniques, general substitutions, dish ideas, pairings, using up leftovers, everyday food facts described in words rather than numbers, shopping, kitchen equipment and seasonal produce. Set general_knowledge to true whenever any part of your answer comes from your own knowledge rather than the context or a tool result.',
      'Never give medical or health advice: nothing about diseases or health conditions, symptoms, medication, pregnancy or breastfeeding, supplements, or eating to lose weight or manage a condition. Decline kindly, mention that a doctor or an Accredited Practising Dietitian is the right person to ask, then offer to help with the cooking side instead. Set declined to true.',
      'Never judge whether a food is safe for this user to eat. If they ask whether an ingredient suits their allergies or diet, use check_ingredient. For spoilage or leftovers, say that when in doubt it should be thrown out, and point to Food Standards Australia New Zealand for guidance.',
      'If a question is not about food or cooking, decline warmly in one short sentence, then steer back to cooking with one concrete, friendly offer tied to the user\'s ingredients or recipes, such as a dish they could make right now. Set declined to true.',
    )
  } else {
    rules.push('Answer only from the context and tool results. If a question needs knowledge SnapWell does not have — food storage, food safety, health or medical advice — say kindly that you can only help with the user\'s ingredients and SnapWell\'s recipes, and suggest something about them they could ask instead.')
  }

  rules.push('Cooking quantities from a recipe itself are fine to mention.')
  return `## Hard rules\n\n${rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n')}`
}

function replyShape(allowGeneral) {
  return allowGeneral
    ? '{"answer": "your reply as plain text", "cited_recipe_ids": ["R001"], "general_knowledge": false, "declined": false}'
    : '{"answer": "your reply as plain text", "cited_recipe_ids": ["R001"]}'
}

function styleAndOutput(allowGeneral) {
  return `## Style

Answer in the same language the user wrote in. Two to four sentences. Practical and concrete, no preamble, no bullet lists unless the user asks for steps.

## Output

Your final reply, after any tool calls, must be JSON only, exactly this shape:
${replyShape(allowGeneral)}`
}

const REPAIR_REQUEST = `The app could not read that reply. Send the same answer again as JSON only, exactly this shape: ${replyShape(ALLOW_GENERAL_FOOD_KNOWLEDGE)}`

/**
 * The instruction is shared rules around one stage-specific section, so a
 * rule — never estimate nutrition, check before suggesting — reads the same on
 * every screen and only the grounding changes. Whether general food knowledge
 * is allowed follows the policy switch unless a caller says otherwise.
 */
export function buildSystemInstruction(
  stage = CHAT_STAGES.RECIPES,
  { allowGeneralKnowledge = ALLOW_GENERAL_FOOD_KNOWLEDGE } = {},
) {
  const section = STAGE_PROMPTS[stage] ?? STAGE_PROMPTS[CHAT_STAGES.RECIPES]
  return [
    `${PROMPT_ROLE}\n\n${allowGeneralKnowledge ? PROMPT_SCOPE.general : PROMPT_SCOPE.strict}`,
    PROMPT_CONTEXT,
    section,
    hardRules(allowGeneralKnowledge),
    styleAndOutput(allowGeneralKnowledge),
  ].join('\n\n')
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

function failure(errorKind, detail = null) {
  return { success: false, errorKind, answer: null, toolCalls: [], detail }
}

function validReply(value) {
  return value && typeof value === 'object' && typeof value.answer === 'string'
}

/**
 * With tools on, Gemini's JSON response mode stays off: tested against this
 * model, the two together made it call the same tool again instead of
 * answering. Without it, the reply can arrive inside a code fence or with a
 * sentence around it, so each of those shapes is tried in turn.
 */
function parseReply(raw) {
  const text = String(raw ?? '').trim()
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  const braced = start >= 0 && end > start ? text.slice(start, end + 1) : ''

  for (const candidate of [text, unfenced, braced]) {
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate)
      if (validReply(parsed)) return parsed
    } catch {
      // Try the next shape
    }
  }
  return null
}

/**
 * One chat turn. Returns the model's parsed reply untouched, plus every tool
 * call made along the way — verification is the guard's job, and the guard
 * needs the tool results to know which figures the app itself produced.
 *
 * The key is resolved the same way the recommendation service resolves it, so
 * the app's one configured key powers both online features and users are never
 * asked for one.
 */
export async function askChat({
  question,
  context,
  history = [],
  toolbox = null,
  apiKey = null,
  model = CHAT_MODEL,
  timeoutMs = DEFAULT_CHAT_TIMEOUT_MS,
  fetchFn = fetch,
  signal = null,
} = {}) {
  const key = getApiKey(apiKey)
  if (!key) return failure(CHAT_ERRORS.NO_KEY)

  const text = String(question ?? '').trim()
  if (!text) return failure(CHAT_ERRORS.BAD_RESPONSE)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs)
  const onExternalAbort = () => controller.abort('cancelled')
  signal?.addEventListener('abort', onExternalAbort)

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
    const systemInstruction = buildSystemInstruction(toolbox?.stage ?? context?.stage)

    const contents = [
      ...historyContents(history),
      {
        role: 'user',
        parts: [{
          text: `Context:\n${JSON.stringify(context)}\n\nUser question:\n${text}`,
        }],
      },
    ]
    const toolCalls = []
    let repairsLeft = MAX_REPAIR_ATTEMPTS
    let answerNow = false

    for (let round = 0; ; round += 1) {
      const toolsOpen = Boolean(toolbox) && !answerNow && round < MAX_TOOL_ROUNDS

      const body = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        ...(toolbox
          ? {
            tools: [{ functionDeclarations: toolbox.declarations }],
            toolConfig: { functionCallingConfig: { mode: toolsOpen ? 'AUTO' : 'NONE' } },
          }
          : { generationConfig: { responseMimeType: 'application/json' } }),
      }

      const response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) return failure(CHAT_ERRORS.NETWORK)

      const json = await response.json()
      const candidate = json?.candidates?.[0]
      const content = candidate?.content
      const parts = Array.isArray(content?.parts) ? content.parts : []
      const calls = parts.filter(part => part?.functionCall?.name)

      if (toolsOpen && calls.length > 0) {
        // The model's turn goes back exactly as it arrived: Gemini attaches
        // thought signatures to these parts and expects them in the follow-up.
        contents.push(content)
        const responses = []
        for (const part of calls) {
          const { name, args, id } = part.functionCall
          const result = await toolbox.run(name, args)
          toolCalls.push({ name, args: args ?? {}, result })
          responses.push({ functionResponse: { name, ...(id ? { id } : {}), response: result } })
        }
        contents.push({ role: 'user', parts: responses })
        continue
      }

      const raw = parts.map(part => (typeof part?.text === 'string' ? part.text : '')).join('')
      const parsed = parseReply(raw)
      if (parsed) return { success: true, errorKind: null, answer: parsed, toolCalls }

      if (repairsLeft > 0) {
        repairsLeft -= 1
        answerNow = true
        // A reply in the wrong shape goes back with a request to reshape it;
        // an empty one is simply asked for again. Tools stay off either way, so
        // the retry can only be an answer.
        if (raw.trim() && calls.length === 0) {
          contents.push(content)
          contents.push({ role: 'user', parts: [{ text: REPAIR_REQUEST }] })
        }
        continue
      }

      return failure(CHAT_ERRORS.BAD_RESPONSE, {
        finishReason: candidate?.finishReason ?? null,
        preview: raw.slice(0, 200),
      })
    }
  } catch (error) {
    const aborted = error?.name === 'AbortError' || controller.signal.aborted
    return failure(aborted ? CHAT_ERRORS.TIMEOUT : CHAT_ERRORS.NETWORK)
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onExternalAbort)
  }
}
