import { ALLERGEN_GROUPS, DIET_EXCLUSIONS } from '../recommendation/preferenceRules.js'
import { candidateRecipeIds } from './chatContext.js'

/**
 * Local verification of a model reply.
 *
 * The model is given a short list of recipes the local engine already ranked
 * and told to answer only within it. That instruction is not a guarantee, so
 * nothing it returns reaches the screen unchecked. Three rules run here, in
 * order of how badly they can hurt: a recipe the app does not know, an
 * ingredient the user cannot eat, and a nutrition figure the model made up.
 *
 * The first two block the reply outright. The third does not — withholding a
 * whole answer over one stray number would be a poor trade — so the figure is
 * removed and the real one is rendered from local AUSNUT data instead.
 */

export const NUTRITION_PLACEHOLDER = '[see the nutrition panel]'

export const BLOCK_REASONS = Object.freeze({
  EMPTY: 'empty',
  UNKNOWN_RECIPE: 'unknown_recipe',
  ALLERGEN: 'allergen',
})

const ENERGY_FIGURE = /\d[\d,.]*\s*(?:kcal|kj|cal|calories|kilojoules)\b/gi

const NUTRIENT_WORD = 'protein|carbs?|carbohydrates?|fat|fibre|fiber|sodium|salt|sugars?'

/**
 * A bare "200 g" is a cooking quantity and must survive — telling someone to
 * add [see the nutrition panel] of beef helps nobody. Only a figure standing
 * next to a nutrient word is treated as a nutrition claim.
 */
const NUTRIENT_BEFORE = new RegExp(
  `\\b(${NUTRIENT_WORD})\\b([^.!?\\n]{0,20}?)(\\d[\\d,.]*\\s*(?:mg|g|grams|milligrams)\\b)`,
  'gi',
)

const NUTRIENT_AFTER = new RegExp(
  `(\\d[\\d,.]*\\s*(?:mg|g|grams|milligrams)\\b)([^.!?\\n]{0,20}?\\b(?:${NUTRIENT_WORD})\\b)`,
  'gi',
)

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
    return { text: answer.trim(), citedRecipeIds: [] }
  }
  const text = typeof answer?.answer === 'string' ? answer.answer.trim() : ''
  const cited = Array.isArray(answer?.cited_recipe_ids) ? answer.cited_recipe_ids : []
  return {
    text,
    citedRecipeIds: cited.map(id => String(id ?? '').trim()).filter(Boolean),
  }
}

function redactNutritionFigures(text) {
  let count = 0
  const mark = () => {
    count += 1
    return NUTRITION_PLACEHOLDER
  }

  let output = text.replace(ENERGY_FIGURE, mark)
  output = output.replace(NUTRIENT_BEFORE, (match, nutrient, gap) => `${nutrient}${gap}${mark()}`)
  output = output.replace(NUTRIENT_AFTER, (match, figure, tail) => `${mark()}${tail}`)

  return { text: output, redactedNumbers: count }
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
  }
}

export function verifyChatAnswer({ answer, context } = {}) {
  const { text, citedRecipeIds } = readReply(answer)

  if (!text) {
    return blocked(
      BLOCK_REASONS.EMPTY,
      'The assistant did not return an answer. Please try again.',
      [],
      citedRecipeIds,
    )
  }

  const allowed = new Set(candidateRecipeIds(context))
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
  for (const [label, trigger] of excluded) {
    const pattern = labelPattern(label)
    if (pattern && pattern.test(text)) {
      return blocked(
        BLOCK_REASONS.ALLERGEN,
        `That reply mentioned ${humanLabel(label)}, which conflicts with your "${describePreference(trigger)}" setting, so it was withheld.`,
        [{ type: 'allergen', value: label, trigger }],
        citedRecipeIds,
      )
    }
  }

  const redacted = redactNutritionFigures(text)

  return {
    status: 'ok',
    reason: null,
    message: null,
    text: redacted.text,
    citedRecipeIds,
    violations: [],
    redactedNumbers: redacted.redactedNumbers,
  }
}
