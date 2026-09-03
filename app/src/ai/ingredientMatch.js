/**
 * Text → ingredient matching layer for the OCR channel.
 *
 * Turns a noisy block of recognised package text into ranked SnapWell
 * ingredient labels, so the user confirms a suggestion instead of typing a
 * name. Every label it can return is already mapped to an AUSNUT food key in
 * data/food_data/ingredient-map-v1.json, so a match is always usable by the
 * nutrition and recipe stages downstream.
 *
 * The matcher searches BOTH channels of that file:
 *   - `ocr`    entries, via their `ocr_keywords` (pantry/packaged goods)
 *   - `vision` entries, via their `aliases` (rice, milk, cheese and other
 *     fresh-list items that are still sold in a printed package)
 *
 * Pure functions only — `buildKeywordIndex` and `matchIngredients` take data
 * and return data, so they are testable outside the browser. Only
 * `loadIngredientIndex` touches the network.
 */

const MAP_URL = '/data/food_data/ingredient-map-v1.json'

/** Digits and symbols Tesseract commonly substitutes for letters. Applied to
 *  the keyword table and the recognised text alike, so it can only help. */
const CONFUSIONS = { 0: 'o', 1: 'l', 5: 's', 8: 'b', '|': 'l', $: 's', '¢': 'c' }

/** Below this score a candidate is not offered to the user at all. */
export const DEFAULT_MIN_SCORE = 0.72
/**
 * A single-word keyword must match exactly. A lone common noun carries no
 * context, so one tolerated character turns "read" into "bread" and "corn"
 * into "cork". Inside a multi-word keyword the neighbouring word supplies that
 * context, so a fuzzy hit there is safe.
 */
/** How far apart the words of a multi-word keyword may drift in the text. */
const SPAN_SLACK = 3

function normaliseToken(raw) {
  const t = String(raw).toLowerCase()
  // Only substitute look-alikes inside words. A pure number is a quantity
  // ("100", "500g"), and mapping it to letters would corrupt it into "loo".
  const hasLetter = /[a-z]/.test(t)
  let out = ''
  for (const ch of t) {
    if (hasLetter && CONFUSIONS[ch]) out += CONFUSIONS[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
  }
  // Naive singular form so "tomatoes"/"oats"/"noodles" match their entries.
  if (out.length > 3 && out.endsWith('es')) out = out.slice(0, -2)
  else if (out.length > 3 && out.endsWith('s')) out = out.slice(0, -1)
  return out
}

/** Split any text into normalised, non-empty tokens. */
export function tokenise(text) {
  return String(text || '')
    .split(/[^A-Za-z0-9|$¢]+/)
    .map(normaliseToken)
    .filter(Boolean)
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]
}

/** Display form: "canned_tomatoes" → "Canned tomatoes". */
export function displayName(label) {
  const words = String(label).replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Flatten ingredient-map-v1.json into a searchable keyword index.
 * Each entry is one keyword (an alias or an OCR keyword) belonging to one label.
 */
export function buildKeywordIndex(map) {
  const index = []
  const push = (entry, source, rawKeywords) => {
    const seen = new Set()
    for (const keyword of String(rawKeywords || '').split(',')) {
      const tokens = tokenise(keyword)
      if (!tokens.length) continue
      const key = tokens.join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      index.push({
        label: entry.label,
        source,
        ausnutKey: entry.ausnut_public_food_key,
        ausnutName: entry.ausnut_food_name,
        keyword: keyword.trim(),
        tokens,
      })
    }
    // The label itself is always a valid keyword ("olive_oil" → "olive oil").
    const selfTokens = tokenise(entry.label)
    const selfKey = selfTokens.join(' ')
    if (selfTokens.length && !seen.has(selfKey)) {
      index.push({
        label: entry.label,
        source,
        ausnutKey: entry.ausnut_public_food_key,
        ausnutName: entry.ausnut_food_name,
        keyword: String(entry.label).replace(/_/g, ' '),
        tokens: selfTokens,
      })
    }
  }

  for (const entry of map.vision || []) push(entry, 'vision', entry.aliases)
  for (const entry of map.ocr || []) push(entry, 'ocr', entry.ocr_keywords)
  return index
}

/**
 * How well one keyword word matches one text word, or 0 for "not a match".
 * Single-word keywords are exact-only; multi-word keywords tolerate one wrong
 * character per word ("olive oil" recognised as "olive uil").
 */
function tokenSimilarity(kwToken, textToken, isMultiWord) {
  const distance = levenshtein(kwToken, textToken)
  if (distance === 0) return 1
  if (!isMultiWord) return 0
  const allowed = kwToken.length <= 4 ? 1 : Math.floor(kwToken.length * 0.3)
  if (distance > allowed) return 0
  return 1 - distance / Math.max(kwToken.length, textToken.length)
}

/**
 * Score one keyword against the tokenised text.
 * Returns null when the keyword is not present well enough to be believable.
 */
function scoreKeyword(entry, textTokens) {
  const isMultiWord = entry.tokens.length > 1
  const hits = []
  for (const kwToken of entry.tokens) {
    let best = { sim: 0, at: -1 }
    for (let i = 0; i < textTokens.length; i += 1) {
      const sim = tokenSimilarity(kwToken, textTokens[i], isMultiWord)
      if (sim > best.sim) best = { sim, at: i }
    }
    if (!best.sim) return null
    hits.push(best)
  }

  // The words of a multi-word keyword must appear close together, otherwise
  // "olive" in the brand line and "oil" 40 words later would count as a match.
  if (entry.tokens.length > 1) {
    const positions = hits.map((h) => h.at)
    const span = Math.max(...positions) - Math.min(...positions)
    if (span > entry.tokens.length - 1 + SPAN_SLACK) return null
    if (new Set(positions).size !== positions.length) return null
  }

  const meanSim = hits.reduce((sum, h) => sum + h.sim, 0) / hits.length
  // Confidence blends how cleanly the words matched with how specific the
  // keyword is: "extra virgin olive oil" is far stronger evidence than "corn".
  const keywordChars = entry.tokens.join('').length
  const specificity = Math.min(1, 0.6 + 0.25 * (entry.tokens.length - 1) + 0.02 * keywordChars)
  const score = 0.55 * meanSim + 0.45 * specificity

  return { score, meanSim, at: Math.min(...hits.map((h) => h.at)) }
}

/**
 * Match recognised text against the index.
 * Returns one ranked entry per label, best keyword first.
 */
export function matchIngredients(text, index, options = {}) {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE
  const limit = options.limit ?? 6
  const textTokens = tokenise(text)
  if (!textTokens.length) return []

  const bestByLabel = new Map()
  for (const entry of index) {
    const scored = scoreKeyword(entry, textTokens)
    if (!scored || scored.score < minScore) continue
    const prev = bestByLabel.get(entry.label)
    if (prev && prev.score >= scored.score) continue
    bestByLabel.set(entry.label, {
      label: entry.label,
      displayName: displayName(entry.label),
      source: entry.source,
      ausnutKey: entry.ausnutKey,
      ausnutName: entry.ausnutName,
      matchedKeyword: entry.keyword,
      score: Number(scored.score.toFixed(3)),
      exact: scored.meanSim === 1,
    })
  }

  return [...bestByLabel.values()]
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
}

/** Every label the matcher can return, for the "pick it yourself" fallback. */
export function allLabels(index) {
  const byLabel = new Map()
  for (const entry of index) {
    if (byLabel.has(entry.label)) continue
    byLabel.set(entry.label, {
      label: entry.label,
      displayName: displayName(entry.label),
      source: entry.source,
      ausnutKey: entry.ausnutKey,
      ausnutName: entry.ausnutName,
    })
  }
  return [...byLabel.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

let indexPromise
/** Fetch and memoise the keyword index for the browser. */
export function loadIngredientIndex() {
  if (!indexPromise) {
    indexPromise = fetch(MAP_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`ingredient map ${res.status}`)
        return res.json()
      })
      .then(buildKeywordIndex)
      .catch((err) => { indexPromise = undefined; throw err })
  }
  return indexPromise
}
