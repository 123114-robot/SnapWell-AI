import { ALLERGEN_GROUPS, DIET_EXCLUSIONS } from '../recommendation/preferenceRules.js'
import { candidateRecipeIds } from './chatContext.js'
import { detectHealthTopic, HEALTH_REFUSAL } from './chatPolicy.js'
import { TOOL_NAMES } from './chatTools.js'

/**
 * Local verification of a model reply.
 *
 * Nothing the model returns reaches the screen unchecked. The rules run in
 * order of how badly they can hurt: health advice, a recipe the app does not
 * know, an ingredient the user cannot eat, and a nutrition figure the app did
 * not calculate.
 *
 * Health advice and a confirmed allergen are answered by the app in its own
 * words. An unknown recipe or an unconfirmed allergen blocks the reply. A
 * stray nutrition figure does not — withholding a whole answer over one number
 * would be a poor trade — so a figure stays only when it matches what a
 * nutrition tool returned in the same turn, and any other figure is removed.
 */

export const NUTRITION_PLACEHOLDER = '[see the nutrition panel]'

export const BLOCK_REASONS = Object.freeze({
  EMPTY: 'empty',
  UNKNOWN_RECIPE: 'unknown_recipe',
  ALLERGEN: 'allergen',
})

const ENERGY_FIGURE = /\d[\d,.]*\s*(?:kcal|kj|cal|calories|kilojoules)\b/gi

const MASS_FIGURE = /\d[\d,.]*\s*(?:mg|g|grams|milligrams)\b/gi

const NUTRIENT_WORD = new RegExp(
  '\\b(?:protein|carbs?|carbohydrates?|fat|fibre|fiber|sodium|salt|sugars?)\\b',
  'gi',
)

// How far apart a figure and its nutrient may sit, as in "protein is about 12 g"
const MAX_NUTRIENT_GAP = 20

// "12 g protein" and "12 g of protein": the nutrient named straight after
const TIGHT_GAP = /^\s*(?:of\s+)?$/i

const NUTRITION_TOOLS = new Set([TOOL_NAMES.GET_RECIPE_NUTRITION, TOOL_NAMES.GET_LIST_NUTRITION])

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `peanut_butter` in the rule set has to find "peanut butter" in prose, and
 * `egg` has to find "eggs". Word boundaries keep it from firing inside a longer
 * word, so "eggplant" is not an egg.
 */
function labelPattern(label) {
  const words = String(label).split('_').filter(Boolean).map(escapeRegExp)
  if (words.length === 0) return null
  return new RegExp(`\\b${words.join('[\\s_-]+')}(?:e?s)?\\b`, 'i')
}

function humanLabel(label) {
  return String(label ?? '').replace(/_/g, ' ').trim()
}

function describePreference(key) {
  const words = humanLabel(key)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Every ingredient the user's stated preferences rule out, each remembered
 * alongside the preference that ruled it out so the block message can say
 * which one fired. The sets come from the recipe filter itself, so the chat can
 * never be more permissive than the recommendations behind it.
 */
function excludedIngredients(preferences) {
  const excluded = new Map()

  const collect = (keys, groups) => {
    for (const key of Array.isArray(keys) ? keys : []) {
      const group = groups[key]
      if (!group) continue
      for (const label of group) {
        if (!excluded.has(label)) excluded.set(label, key)
      }
    }
  }

  collect(preferences?.allergens, ALLERGEN_GROUPS)
  collect(preferences?.diets, DIET_EXCLUSIONS)

  return excluded
}

function readReply(answer) {
  if (typeof answer === 'string') {
    return { text: answer.trim(), citedRecipeIds: [], generalKnowledge: false, declined: false }
  }
  const text = typeof answer?.answer === 'string' ? answer.answer.trim() : ''
  const cited = Array.isArray(answer?.cited_recipe_ids) ? answer.cited_recipe_ids : []
  return {
    text,
    citedRecipeIds: cited.map(id => String(id ?? '').trim()).filter(Boolean),
    generalKnowledge: answer?.general_knowledge === true,
    declined: answer?.declined === true,
  }
}

/**
 * Recipe ids belong in cited_recipe_ids, not in front of people. An id written
 * next to a name — "Pork pumpkin plate (R074)" — is taken out; an id standing
 * in for the name — "try R074" — gets the name put back in its place.
 */
function removeRecipeIds(text, ids, names) {
  let output = text
  // Longest first, so R0741 is never half-matched by R074
  for (const id of [...ids].sort((left, right) => right.length - left.length)) {
    const escaped = escapeRegExp(id)
    output = output.replace(
      new RegExp(`\\s*[([]\\s*(?:recipe\\s*)?(?:id\\s*[:#]?\\s*)?${escaped}\\s*[)\\]]`, 'gi'),
      '',
    )
    const name = names.get(id)
    if (name) {
      output = output.replace(
        new RegExp(`(?:\\brecipe\\s+)?(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'gi'),
        name,
      )
    }
  }
  return output
}

/**
 * Every value a nutrition tool returned this turn, grouped by nutrient — a
 * recipe's per-serving figures and a list's totals alike. What basis a figure
 * is quoted on is left to the prompt; the value itself has to be the app's.
 */
function toolFigures(toolCalls) {
  const figures = {
    kcal: new Set(), protein_g: new Set(), carbs_g: new Set(),
    fat_g: new Set(), fibre_g: new Set(), sodium_mg: new Set(),
  }
  for (const call of Array.isArray(toolCalls) ? toolCalls : []) {
    if (!NUTRITION_TOOLS.has(call?.name)) continue
    const values = call?.result?.per_serving ?? call?.result?.total
    if (!values) continue
    for (const field of Object.keys(figures)) {
      if (Number.isFinite(values[field])) figures[field].add(values[field])
    }
  }
  return figures
}

function spans(pattern, text) {
  return [...text.matchAll(pattern)].map(match => ({
    start: match.index,
    end: match.index + match[0].length,
    text: match[0],
  }))
}

function figureValue(figure) {
  const digits = String(figure).match(/\d[\d,.]*/)?.[0] ?? ''
  return Number(digits.replace(/,/g, '').replace(/\.+$/, ''))
}

function figureUnit(figure) {
  if (/kj|kilojoule/i.test(figure)) return 'kj'
  if (/cal/i.test(figure)) return 'kcal'
  if (/mg|milligram/i.test(figure)) return 'mg'
  return 'g'
}

/** Salt and sugar have no tool field, so a figure for either is never verified. */
function nutrientField(word) {
  const nutrient = String(word ?? '').toLowerCase()
  if (nutrient.startsWith('protein')) return 'protein_g'
  if (nutrient.startsWith('carb')) return 'carbs_g'
  if (nutrient === 'fat') return 'fat_g'
  if (nutrient.startsWith('fib')) return 'fibre_g'
  if (nutrient === 'sodium') return 'sodium_mg'
  return null
}

function energyVerified(figure, figures) {
  return figureUnit(figure) === 'kcal' && figures.kcal.has(figureValue(figure))
}

/**
 * The value, the unit and the nutrient all have to line up. A carbs figure
 * quoted as protein is still a wrong claim, even though the number is real.
 */
function nutrientVerified(word, figure, figures) {
  const field = nutrientField(word)
  if (!field) return false
  const expectedUnit = field.endsWith('_mg') ? 'mg' : 'g'
  return figureUnit(figure) === expectedUnit && figures[field].has(figureValue(figure))
}

function crossesSentence(gap) {
  return /[!?\n]|\.(?:\s|$)/.test(gap)
}

/**
 * Pairs each gram or milligram figure with the nutrient it is about.
 *
 * Prose names nutrients on both sides of their figures — "1.1 g of protein,
 * 0 g of fat" and "protein 12.4 g and fat 15.2 g" — so reading only one
 * direction pairs half of a list with its neighbour's nutrient. A figure takes
 * the nutrient named straight after it first ("0 g of fat"); failing that, the
 * nearest unclaimed one before it ("protein: 12.4 g"); failing that, one a
 * little further after. No pairing may reach past another figure or across a
 * sentence. A figure no nutrient claims is a cooking quantity and is left
 * alone.
 */
function pairNutrients(text, masses, words) {
  const pairs = new Map()
  const claimed = new Set()

  const near = (from, to) => to - from <= MAX_NUTRIENT_GAP
    && !crossesSentence(text.slice(from, to))
    && !masses.some(figure => figure.start >= from && figure.end <= to)

  const claim = (figure, word) => {
    pairs.set(figure, word.text)
    claimed.add(word)
  }

  for (const figure of masses) {
    const next = words.find(word => word.start >= figure.end)
    if (next && TIGHT_GAP.test(text.slice(figure.end, next.start))) claim(figure, next)
  }

  for (const figure of masses) {
    if (pairs.has(figure)) continue
    const previous = words.filter(word => word.end <= figure.start && !claimed.has(word)).at(-1)
    if (previous && near(previous.end, figure.start)) {
      claim(figure, previous)
      continue
    }
    const next = words.find(word => word.start >= figure.end && !claimed.has(word))
    if (next && near(figure.end, next.start)) claim(figure, next)
  }

  return pairs
}

function checkNutritionFigures(text, figures) {
  const removals = []
  let verifiedNumbers = 0

  const judge = (span, verified) => {
    if (verified) verifiedNumbers += 1
    else removals.push(span)
  }

  for (const span of spans(ENERGY_FIGURE, text)) {
    judge(span, energyVerified(span.text, figures))
  }

  const masses = spans(MASS_FIGURE, text)
  const pairs = pairNutrients(text, masses, spans(NUTRIENT_WORD, text))
  for (const figure of masses) {
    if (pairs.has(figure)) judge(figure, nutrientVerified(pairs.get(figure), figure.text, figures))
  }

  let output = text
  for (const span of removals.sort((left, right) => right.start - left.start)) {
    output = `${output.slice(0, span.start)}${NUTRITION_PLACEHOLDER}${output.slice(span.end)}`
  }

  return { text: output, redactedNumbers: removals.length, verifiedNumbers }
}

function blocked(reason, message, violations, citedRecipeIds) {
  return {
    status: 'blocked',
    reason,
    message,
    text: '',
    citedRecipeIds,
    violations,
    redactedNumbers: 0,
    verifiedNumbers: 0,
    generalKnowledge: false,
    declined: false,
  }
}

/** A reply the app writes itself, in place of what the model sent. */
function answeredByApp(text, extra = {}) {
  return {
    status: 'ok',
    reason: null,
    message: null,
    text,
    citedRecipeIds: [],
    violations: [],
    redactedNumbers: 0,
    verifiedNumbers: 0,
    generalKnowledge: false,
    declined: false,
    answeredByApp: true,
    ...extra,
  }
}

/** Ingredients the check_ingredient tool confirmed, this turn, as off-limits. */
function confirmedConflicts(toolCalls) {
  const labels = new Set()
  for (const call of Array.isArray(toolCalls) ? toolCalls : []) {
    if (call?.name !== TOOL_NAMES.CHECK_INGREDIENT || call?.result?.allowed !== false) continue
    const label = String(call.result.ingredient ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
    if (label) labels.add(label)
  }
  return labels
}

/**
 * `allowedRecipeIds` adds the recipes the tools could return — the rest of the
 * user's list — to the ones in the context summary, and `recipeNames` names
 * them. `toolCalls` is the turn's tool record, the only source a nutrition
 * figure may be verified against.
 */
export function verifyChatAnswer({
  answer,
  context,
  allowedRecipeIds = [],
  recipeNames = {},
  toolCalls = [],
} = {}) {
  const { text, citedRecipeIds, generalKnowledge, declined } = readReply(answer)

  if (!text) {
    return blocked(
      BLOCK_REASONS.EMPTY,
      'The assistant did not return an answer. Please try again.',
      [],
      citedRecipeIds,
    )
  }

  // The prompt already rules health advice out; this is the second line, for
  // the reply that drifts there anyway
  if (detectHealthTopic(text)) {
    return answeredByApp(HEALTH_REFUSAL, { healthRefusal: true })
  }

  const allowed = new Set([
    ...candidateRecipeIds(context),
    ...(Array.isArray(allowedRecipeIds) ? allowedRecipeIds.map(String) : []),
  ])
  const unknown = citedRecipeIds.filter(id => !allowed.has(id))
  if (unknown.length > 0) {
    return blocked(
      BLOCK_REASONS.UNKNOWN_RECIPE,
      'That reply referred to a recipe that is not on your list, so it was withheld. The assistant can only discuss the recipes shown here.',
      unknown.map(id => ({ type: 'unknown_recipe', value: id, trigger: null })),
      citedRecipeIds,
    )
  }

  const excluded = excludedIngredients(context?.preferences)
  const confirmed = confirmedConflicts(toolCalls)
  for (const [label, trigger] of excluded) {
    const pattern = labelPattern(label)
    if (!pattern || !pattern.test(text)) continue

    if (confirmed.has(label)) {
      // The app's own rules told the model this ingredient conflicts, so the
      // mention is almost certainly the warning — but near an allergen its
      // wording is still not trusted. The app states the conflict itself.
      return answeredByApp(
        `${describePreference(label)} conflicts with your "${describePreference(trigger)}" setting, so SnapWell does not suggest adding it.`,
      )
    }

    return blocked(
      BLOCK_REASONS.ALLERGEN,
      `That reply mentioned ${humanLabel(label)}, which conflicts with your "${describePreference(trigger)}" setting, so it was withheld.`,
      [{ type: 'allergen', value: label, trigger }],
      citedRecipeIds,
    )
  }

  const names = new Map([
    ...(Array.isArray(context?.candidate_recipes) ? context.candidate_recipes : [])
      .map(recipe => [recipe.recipe_id, recipe.name]),
    ...Object.entries(recipeNames ?? {}),
  ].filter(([id, name]) => id && name))

  const checked = checkNutritionFigures(removeRecipeIds(text, allowed, names), toolFigures(toolCalls))

  return {
    status: 'ok',
    reason: null,
    message: null,
    text: checked.text,
    citedRecipeIds,
    violations: [],
    redactedNumbers: checked.redactedNumbers,
    verifiedNumbers: checked.verifiedNumbers,
    generalKnowledge,
    declined,
  }
}
