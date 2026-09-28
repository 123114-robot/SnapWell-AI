/**
 * Recipe assistant evaluation: runs every question in questions.json under two
 * conditions and appends one JSON line per (question, condition) to
 * results/<run>.jsonl.
 *
 *   grounded  the shipped pipeline: health pre-check, context pack, local
 *             tools, Gemini, then the verification layer. The model's raw
 *             reply is kept next to the verified one, so the "no verification"
 *             ablation is scored on exactly the same replies.
 *   direct    the same model given the same list, preferences and recipe
 *             summaries as plain text, with no tools, no output format and no
 *             verification: what a general chatbot bolted onto the app would do.
 *
 * Usage:  node scripts/eval-assistant/run.mjs <run-name> [path/to/.env]
 * Set ONLY=A1,B2 to run a subset, BYPASS_PRECHECK=1 for the pre-check ablation.
 * A run can be resumed: lines already in the results file are skipped.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadApiKey, stateFor } from './harness.mjs'
import { askChat, CHAT_MODEL } from '../../src/chat/chatService.js'
import { buildChatContext } from '../../src/chat/chatContext.js'
import { createChatToolbox } from '../../src/chat/chatTools.js'
import { verifyChatAnswer } from '../../src/chat/chatGuard.js'
import { detectHealthTopic, HEALTH_REFUSAL } from '../../src/chat/chatPolicy.js'
import { displayIngredientLabel } from '../../src/recommendation/recommendationAdapter.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const runName = process.argv[2]
if (!runName) throw new Error('Usage: node run.mjs <run-name> [envPath]')
const envPath = process.argv[3] ?? path.resolve(HERE, '../../.env')
const apiKey = loadApiKey(envPath)

const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
const questions = JSON.parse(readFileSync(path.join(HERE, 'questions.json'), 'utf8'))
  .questions.filter(question => !only || only.has(question.id))
const resultsDir = path.join(HERE, 'results')
mkdirSync(resultsDir, { recursive: true })
const outFile = path.join(resultsDir, `${runName}.jsonl`)

const done = new Set(existsSync(outFile)
  ? readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map(line => {
    const row = JSON.parse(line)
    return `${row.id}|${row.condition}`
  })
  : [])

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Counts requests and retries rate-limit and server errors, so a busy API
 * shows up as extra latency rather than as a wrong answer. The URL carries the
 * key, so it is never logged.
 */
function countingFetch(stats) {
  return async (url, init) => {
    for (let attempt = 0; ; attempt += 1) {
      stats.requests += 1
      const response = await fetch(url, init)
      if (![429, 500, 503].includes(response.status) || attempt >= 5) return response
      stats.retries += 1
      await sleep(5000 * 2 ** attempt)
    }
  }
}

async function runGrounded(question, { bypassPrecheck = false } = {}) {
  const { profile, stage, focusedRecipeId, recommendationResult } = await stateFor(question)
  const started = Date.now()

  if (!bypassPrecheck && detectHealthTopic(question.text)) {
    return {
      stage,
      appPrecheck: true,
      latencyMs: Date.now() - started,
      requests: 0,
      retries: 0,
      success: true,
      raw: null,
      toolCalls: [],
      verdict: { status: 'ok', text: HEALTH_REFUSAL, answeredByApp: true, healthRefusal: true },
    }
  }

  const context = buildChatContext({
    stage,
    ingredients: profile.ingredients,
    preferences: profile.preferences,
    recommendationResult,
    focusedRecipeId,
  })
  const toolbox = createChatToolbox({
    stage,
    recommendationResult,
    preferences: profile.preferences,
    ingredients: profile.ingredients,
  })
  const stats = { requests: 0, retries: 0 }
  const result = await askChat({
    question: question.text,
    context,
    toolbox,
    apiKey,
    fetchFn: countingFetch(stats),
  })
  const latencyMs = Date.now() - started

  if (!result.success) {
    return { stage, appPrecheck: false, latencyMs, ...stats, success: false, errorKind: result.errorKind, detail: result.detail ?? null }
  }

  const verdict = verifyChatAnswer({
    answer: result.answer,
    context,
    allowedRecipeIds: toolbox.allowedRecipeIds(),
    recipeNames: toolbox.recipeNames(),
    toolCalls: result.toolCalls,
  })

  return {
    stage,
    appPrecheck: false,
    latencyMs,
    ...stats,
    success: true,
    raw: result.answer,
    toolCalls: result.toolCalls,
    allowedRecipeIds: toolbox.allowedRecipeIds(),
    verdict,
  }
}

function describeRecipe(recipe) {
  return `- ${recipe.name}: ${recipe.ingredients.map(displayIngredientLabel).join(', ')}`
}

async function runDirect(question) {
  const { profile, stage, focusedRecipeId, recommendationResult } = await stateFor(question)
  const shown = recommendationResult?.recommendations ?? []
  const summary = shown.slice(0, 5)
  const focused = shown.find(recipe => recipe.id === focusedRecipeId)
  if (focused && !summary.includes(focused)) summary.push(focused)

  const lines = [
    `My ingredients: ${profile.ingredients.map(item => displayIngredientLabel(item.label)).join(', ')}.`,
    `My dietary settings: ${[...profile.preferences.diets, ...profile.preferences.allergies].join(', ') || 'none'}.`,
  ]
  if (summary.length) lines.push(`Recipes the app is showing me:\n${summary.map(describeRecipe).join('\n')}`)
  if (focused) lines.push(`I am looking at: ${focused.name}.`)
  lines.push(`Question: ${question.text}`)

  const stats = { requests: 0, retries: 0 }
  const started = Date.now()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(CHAT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await countingFetch(stats)(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: 'You are a helpful cooking assistant inside a recipe app. Answer in two to four sentences.' }] },
      contents: [{ role: 'user', parts: [{ text: lines.join('\n\n') }] }],
    }),
  })
  const latencyMs = Date.now() - started
  if (!response.ok) return { stage, latencyMs, ...stats, success: false, errorKind: `http_${response.status}` }
  const json = await response.json()
  const text = (json?.candidates?.[0]?.content?.parts ?? []).map(part => part?.text ?? '').join('').trim()
  return { stage, latencyMs, ...stats, success: Boolean(text), text }
}

/**
 * With BYPASS_PRECHECK=1 only the questions the health pre-check answers are
 * run, through the model anyway, so the no-verification ablation has a model
 * reply to score for them too. The app itself never sends these.
 */
const CONDITIONS = process.env.BYPASS_PRECHECK
  ? { grounded_bypass: question => runGrounded(question, { bypassPrecheck: true }) }
  : { grounded: runGrounded, direct: runDirect }

for (const question of questions) {
  if (process.env.BYPASS_PRECHECK && !detectHealthTopic(question.text)) continue
  for (const [condition, run] of Object.entries(CONDITIONS)) {
    if (done.has(`${question.id}|${condition}`)) continue
    let outcome
    try {
      outcome = await run(question)
    } catch (error) {
      outcome = { success: false, errorKind: 'exception', detail: String(error?.message ?? error) }
    }
    appendFileSync(outFile, `${JSON.stringify({ id: question.id, condition, model: CHAT_MODEL, at: new Date().toISOString(), ...outcome })}\n`)
    const status = outcome.success ? (outcome.verdict?.status ?? 'ok') : `FAILED ${outcome.errorKind}`
    console.log(`${question.id} ${condition.padEnd(8)} ${String(outcome.latencyMs ?? '-').padStart(6)} ms  req ${outcome.requests ?? 0}  ${status}`)
    await sleep(1500)
  }
}
