/**
 * Runs the real assistant pipeline in Node, outside the browser.
 *
 * The app's modules load their data with fetch('/data/food_data/...'). Here
 * those paths are served from public/, and every other request (the Gemini
 * API) goes out through curl, so the code under test is exactly the code the
 * app ships.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

import { recommendationEngine } from '../../src/recommendation/recommendationEngine.js'
import { adaptRecommendationResult } from '../../src/recommendation/recommendationAdapter.js'
import { CHAT_STAGES, chatStageFor, focusedRecipeIdFor } from '../../src/chat/chatStages.js'

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PUBLIC_DIR = path.join(APP_DIR, 'public')

/**
 * Node's built-in fetch ignores HTTPS_PROXY, and some networks only reach
 * Google through a proxy. curl honours it, so outbound requests go through
 * curl. The URL (which carries the key) is passed on stdin, never on the
 * command line, so it does not show up in the process list.
 */
function curlFetch(url, init = {}) {
  const bodyFile = path.join(tmpdir(), `snapwell-eval-${randomUUID()}.json`)
  writeFileSync(bodyFile, String(init.body ?? ''))
  const config = [
    `url = "${String(url)}"`,
    `request = "${init.method ?? 'GET'}"`,
    'header = "Content-Type: application/json"',
    `data-binary = "@${bodyFile}"`,
    'silent',
    'max-time = 60',
    'write-out = "\\n%{http_code}"',
  ].join('\n')

  return new Promise((resolve, reject) => {
    const child = execFile('curl', ['-K', '-'], { maxBuffer: 32 * 1024 * 1024, signal: init.signal ?? undefined },
      (error, stdout) => {
        try { unlinkSync(bodyFile) } catch { /* already gone */ }
        if (error) {
          reject(error.name === 'AbortError' ? Object.assign(new Error('aborted'), { name: 'AbortError' }) : error)
          return
        }
        const cut = stdout.lastIndexOf('\n')
        const status = Number(stdout.slice(cut + 1)) || 599
        resolve(new Response(stdout.slice(0, cut), { status, headers: { 'Content-Type': 'application/json' } }))
      })
    child.stdin.end(config)
  })
}

globalThis.fetch = async (url, init) => {
  const target = String(url)
  if (target.startsWith('/data/')) {
    const body = readFileSync(path.join(PUBLIC_DIR, target), 'utf8')
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return curlFetch(url, init)
}

/** Reads the key from app/.env without printing it. */
export function loadApiKey(envPath) {
  const text = readFileSync(envPath, 'utf8')
  const line = text.split('\n').find(row => row.startsWith('VITE_GEMINI_API_KEY='))
  const key = line?.slice('VITE_GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '')
  if (!key) throw new Error(`No VITE_GEMINI_API_KEY in ${envPath}`)
  return key
}

const item = (label, quantity = 1, unit = 'piece') => ({ label, quantity, unit, source: 'manual' })

/**
 * Three user profiles. Each list is what a user would have after the
 * ingredient confirmation screen; the preferences are the ones the app offers.
 */
export const PROFILES = Object.freeze({
  everyday: {
    description: 'No dietary settings',
    ingredients: [
      item('chicken_breast', 2), item('rice', 1, 'cup'), item('broccoli', 1),
      item('garlic', 3, 'clove'), item('soy_sauce', 2, 'tbsp'), item('egg', 4),
      item('onion', 1), item('carrot', 2),
    ],
    preferences: { diets: [], allergies: [], goals: [] },
  },
  vegetarian: {
    description: 'Vegetarian, no nuts',
    ingredients: [
      item('tofu', 1), item('rice', 1, 'cup'), item('spinach', 2, 'cup'),
      item('mushroom', 2, 'cup'), item('garlic', 2, 'clove'), item('soy_sauce', 1, 'tbsp'),
      item('capsicum', 1), item('egg', 2), item('oats', 1, 'cup'), item('milk', 1, 'cup'),
      item('banana', 2),
    ],
    preferences: { diets: ['Vegetarian'], allergies: ['No nuts'], goals: [] },
  },
  dairyFree: {
    description: 'Dairy-free, no shellfish',
    ingredients: [
      item('pasta', 200, 'g'), item('canned_tomatoes', 1, 'cup'), item('onion', 1),
      item('garlic', 2, 'clove'), item('beef_mince', 500, 'g'), item('zucchini', 1),
      item('olive_oil', 2, 'tbsp'), item('salmon', 300, 'g'), item('potato', 3),
    ],
    preferences: { diets: ['Dairy-free'], allergies: ['No shellfish'], goals: [] },
  },
})

/** The ranked list the recipe screens would show, from the local engine only. */
export async function recommendationsFor(profile) {
  const result = await recommendationEngine(
    { ingredients: profile.ingredients, preferences: profile.preferences },
    null,
    { allowOnline: false, localTopUpCount: 0 },
  )
  return adaptRecommendationResult(result)
}

export const PAGE_PATHS = {
  home: () => '/',
  ingredients: () => '/confirm',
  recommendations: () => '/recommendations',
  recipe: id => `/recipe/${id}`,
  nutrition: id => `/nutrition/${id}`,
  missing: () => '/missing',
}

const recommendationCache = new Map()
/** The app state a question is asked in: stage, focused recipe, ranked list. */
export async function stateFor(question) {
  const profile = PROFILES[question.profile]
  if (!recommendationCache.has(question.profile)) {
    recommendationCache.set(question.profile, await recommendationsFor(profile))
  }
  const recommendationResult = recommendationCache.get(question.profile)
  const pathname = PAGE_PATHS[question.page](question.focus)
  const stage = chatStageFor(pathname)
  const selectedRecipe = question.focus
    ? recommendationResult.recommendations.find(recipe => recipe.id === question.focus) ?? null
    : null
  return {
    profile,
    stage,
    focusedRecipeId: focusedRecipeIdFor(pathname, selectedRecipe),
    // The recipe screens have a ranked list; before it exists the app holds none
    recommendationResult: stage === CHAT_STAGES.RECIPES ? recommendationResult : null,
  }
}

export { CHAT_STAGES }
