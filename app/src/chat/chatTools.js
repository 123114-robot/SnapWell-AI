import { ALLERGEN_GROUPS, DIET_EXCLUSIONS, normalisePreference } from '../recommendation/preferenceRules.js'
import { matchRecipes, normaliseIngredientLabel } from '../recommendation/recipeMatcher.js'
import { displayIngredientLabel } from '../recommendation/recommendationAdapter.js'
import { calculateIngredientListNutrition } from '../recommendation/nutritionService.js'
import { loadNutritionCalculationData, loadRecommendationData } from '../recommendation/foodDataService.js'
import { LOCAL_MATCH_THRESHOLD } from '../recommendation/recommendationEngine.js'
import { appHelp } from './appGuide.js'
import { CHAT_STAGES } from './chatStages.js'
import { nutritionPerServing, packCandidate } from './chatContext.js'

/**
 * The assistant's tools: the app's own functions, offered to the model through
 * Gemini function calling and run here, on the device.
 *
 * The split is deliberate. The model decides what to look up and how to say
 * it; the lookups themselves — which recipes fit, what a list contains, which
 * ingredient would help most, whether an ingredient is safe for this user, how
 * the app works — are answered by the same deterministic code and data the rest
 * of the app uses. Each stage offers only the tools that fit what the user is
 * looking at.
 */

export const TOOL_NAMES = Object.freeze({
  FIND_RECIPES: 'find_recipes',
  GET_RECIPE_DETAILS: 'get_recipe_details',
  GET_RECIPE_NUTRITION: 'get_recipe_nutrition',
  CHECK_INGREDIENT: 'check_ingredient',
  PREVIEW_RECIPES: 'preview_recipes',
  SUGGEST_ADDITIONS: 'suggest_additions',
  GET_LIST_NUTRITION: 'get_list_nutrition',
  GET_APP_HELP: 'get_app_help',
})

/**
 * The app guide is offered everywhere: a question about how SnapWell works can
 * come up on any screen, not only the one built for it.
 */
export const STAGE_TOOLS = Object.freeze({
  [CHAT_STAGES.HOME]: Object.freeze([
    TOOL_NAMES.GET_APP_HELP,
  ]),
  [CHAT_STAGES.INGREDIENTS]: Object.freeze([
    TOOL_NAMES.PREVIEW_RECIPES,
    TOOL_NAMES.SUGGEST_ADDITIONS,
    TOOL_NAMES.GET_LIST_NUTRITION,
    TOOL_NAMES.CHECK_INGREDIENT,
    TOOL_NAMES.GET_APP_HELP,
  ]),
  [CHAT_STAGES.RECIPES]: Object.freeze([
    TOOL_NAMES.FIND_RECIPES,
    TOOL_NAMES.GET_RECIPE_DETAILS,
    TOOL_NAMES.GET_RECIPE_NUTRITION,
    TOOL_NAMES.CHECK_INGREDIENT,
    TOOL_NAMES.GET_APP_HELP,
  ]),
})

export const MAX_FIND_RESULTS = 8
export const MAX_SUGGESTIONS = 5
const DEFAULT_SUGGESTIONS = 3
const BOOK_SOURCE = 'SnapWell recipe book'

const RECIPE_ID_PARAMETERS = {
  type: 'object',
  properties: {
    recipe_id: {
      type: 'string',
      description: 'The exact recipe_id, from the context or an earlier tool result.',
    },
  },
  required: ['recipe_id'],
}

const MAX_MISSING_PARAMETER = {
  type: 'integer',
  description: 'Only recipes missing at most this many ingredients.',
}

export const TOOL_DECLARATIONS = Object.freeze([
  {
    name: TOOL_NAMES.FIND_RECIPES,
    description: 'Search every recipe on the user\'s list, not only the summary in the context. '
      + 'Returns matches in the order the app ranked them.',
    parameters: {
      type: 'object',
      properties: {
        uses_ingredients: {
          type: 'array',
          items: { type: 'string' },
          description: 'Only recipes that use every one of these ingredients.',
        },
        max_missing_ingredients: MAX_MISSING_PARAMETER,
        meal_type: {
          type: 'string',
          description: 'breakfast, lunch, dinner, snack or side.',
        },
      },
    },
  },
  {
    name: TOOL_NAMES.GET_RECIPE_DETAILS,
    description: 'Ingredients, steps and missing ingredients for one recipe on the user\'s list.',
    parameters: RECIPE_ID_PARAMETERS,
  },
  {
    name: TOOL_NAMES.GET_RECIPE_NUTRITION,
    description: 'Per-serving nutrition for one recipe on the user\'s list, calculated by the app '
      + 'from AUSNUT 2023 reference data.',
    parameters: RECIPE_ID_PARAMETERS,
  },
  {
    name: TOOL_NAMES.CHECK_INGREDIENT,
    description: 'Check one ingredient against the user\'s allergens and dietary pattern using the '
      + 'app\'s own rules. Use it for an ingredient you propose yourself, or one the user asks about, '
      + 'and only when the user has allergens or a diet set.',
    parameters: {
      type: 'object',
      properties: {
        ingredient: { type: 'string', description: 'The ingredient to check, e.g. "peanut butter".' },
      },
      required: ['ingredient'],
    },
  },
  {
    name: TOOL_NAMES.PREVIEW_RECIPES,
    description: 'Rank the SnapWell recipe book against the ingredients on the user\'s list, the same '
      + 'way the app ranks it. Returns the best matches, how many reach a strong match, and what each '
      + 'recipe is missing.',
    parameters: {
      type: 'object',
      properties: { max_missing_ingredients: MAX_MISSING_PARAMETER },
    },
  },
  {
    name: TOOL_NAMES.SUGGEST_ADDITIONS,
    description: 'Work out which single ingredient, added to the user\'s list, would bring the most '
      + 'SnapWell recipes up to a strong match. Each suggestion is already checked against the '
      + 'user\'s allergens and diet.',
    parameters: {
      type: 'object',
      properties: {
        max_suggestions: {
          type: 'integer',
          description: `How many suggestions to return, 1 to ${MAX_SUGGESTIONS}. Defaults to ${DEFAULT_SUGGESTIONS}.`,
        },
      },
    },
  },
  {
    name: TOOL_NAMES.GET_LIST_NUTRITION,
    description: 'Total nutrition for the ingredients on the user\'s list at the quantities entered, '
      + 'calculated from AUSNUT 2023 reference data. Pass one ingredient to get it on its own.',
    parameters: {
      type: 'object',
      properties: {
        ingredient: { type: 'string', description: 'Optional: one ingredient from the list.' },
      },
    },
  },
  {
    name: TOOL_NAMES.GET_APP_HELP,
    description: 'Look up the SnapWell app guide: how the app works, its screens and features, Local '
      + 'and Online mode, what data leaves the device, and what this assistant can do.',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'What the user wants to know, in a few English words, e.g. "local vs online mode".',
        },
      },
      required: ['topic'],
    },
  },
])

/** How each tool is named where the user can see it. */
export const TOOL_LABELS = Object.freeze({
  [TOOL_NAMES.FIND_RECIPES]: 'recipe search',
  [TOOL_NAMES.GET_RECIPE_DETAILS]: 'recipe details',
  [TOOL_NAMES.GET_RECIPE_NUTRITION]: 'AUSNUT nutrition',
  [TOOL_NAMES.CHECK_INGREDIENT]: 'allergy and diet rules',
  [TOOL_NAMES.PREVIEW_RECIPES]: 'recipe book matching',
  [TOOL_NAMES.SUGGEST_ADDITIONS]: 'ingredient gap analysis',
  [TOOL_NAMES.GET_LIST_NUTRITION]: 'AUSNUT nutrition',
  [TOOL_NAMES.GET_APP_HELP]: 'the SnapWell app guide',
})

/**
 * The recipes the user can actually see. The Recommendations screen hides a
 * local recipe that shares no ingredient with the list, so the tools hide it
 * too — the assistant should never point at a card that is not on screen.
 */
export function visibleRecipes(recommendationResult) {
  const ranked = Array.isArray(recommendationResult?.recommendations)
    ? recommendationResult.recommendations
    : []
  return ranked.filter(recipe => recipe?.id != null
    && (recipe.coverageScore > 0 || recipe.source === 'online'))
}

/** "eggs" and "tomatoes" have to find "egg" and "tomato" in the rules and recipes. */
function labelForms(value) {
  const label = normaliseIngredientLabel(value)
  if (!label) return []
  const forms = new Set([label])
  if (label.endsWith('es')) forms.add(label.slice(0, -2))
  if (label.endsWith('s')) forms.add(label.slice(0, -1))
  return [...forms]
}

function sameIngredient(left, right) {
  const rightForms = labelForms(right)
  return labelForms(left).some(form => rightForms.includes(form))
}

function selected(values) {
  return (Array.isArray(values) ? values : []).map(normalisePreference).filter(Boolean)
}

function optionalCount(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

function roundTo(value, places) {
  const factor = 10 ** places
  return Math.round(Number(value) * factor) / factor
}

/**
 * Rounded the way the nutrition panel shows them — whole kcal and mg, one
 * decimal for grams — so a figure the model quotes reads the same as the panel,
 * and the guard can compare it exactly.
 */
function roundFigures(values) {
  return {
    kcal: roundTo(values?.kcal, 0),
    protein_g: roundTo(values?.protein, 1),
    carbs_g: roundTo(values?.carbs, 1),
    fat_g: roundTo(values?.fat, 1),
    fibre_g: roundTo(values?.fibre, 1),
    sodium_mg: roundTo(values?.sodium, 0),
  }
}

function notOnList(recipeId) {
  return {
    error: 'not_on_list',
    recipe_id: String(recipeId ?? ''),
    message: 'No recipe with this id is on the user\'s list.',
  }
}

function recipeSummary(recipe) {
  const packed = packCandidate(recipe)
  return {
    recipe_id: packed.recipe_id,
    name: packed.name,
    source: packed.source,
    meal_type: packed.meal_type,
    coverage_score: packed.coverage_score,
    missing_ingredients: packed.missing_ingredients,
  }
}

function findRecipes(recipes, args) {
  const wanted = (Array.isArray(args.uses_ingredients) ? args.uses_ingredients : [])
    .map(normaliseIngredientLabel)
    .filter(Boolean)
  const maxMissing = optionalCount(args.max_missing_ingredients)
  const mealType = normalisePreference(args.meal_type)

  const matches = recipes.filter(recipe => {
    const ingredients = new Set((recipe.ingredients ?? []).map(normaliseIngredientLabel))
    if (!wanted.every(label => labelForms(label).some(form => ingredients.has(form)))) return false
    if (maxMissing !== null && (recipe.missingIngredients?.length ?? 0) > maxMissing) return false
    if (mealType && normalisePreference(recipe.mealType) !== mealType) return false
    return true
  })

  return {
    total_matches: matches.length,
    recipes: matches.slice(0, MAX_FIND_RESULTS).map(recipeSummary),
  }
}

function recipeNutrition(recipe) {
  const base = { recipe_id: String(recipe.id), name: String(recipe.name ?? '') }
  if (!nutritionPerServing(recipe.nutrition)) {
    return { ...base, available: false, reason: 'The app has no nutrition data for this recipe.' }
  }

  return {
    ...base,
    basis: 'per serving',
    available: true,
    partial: Boolean(recipe.nutrition.partial),
    unresolved_ingredients: Array.isArray(recipe.nutrition.unresolvedIngredients)
      ? [...recipe.nutrition.unresolvedIngredients]
      : [],
    per_serving: roundFigures(recipe.nutrition.perServing),
    source: recipe.nutrition.source ?? 'AUSNUT 2023 reference data',
    // A generated recipe costed without its own amounts is only a rough guide
    ...(recipe.source === 'online' && recipe.nutrition.quantitiesFromRecipe !== true
      ? { note: 'Estimated from the quantities on the user\'s list, not this recipe\'s own amounts.' }
      : {}),
  }
}

/**
 * "No conflict" and "safe" are different claims. The rule sets cover a short
 * ingredient list, and some allergy settings ("No milk", "No sesame") have no
 * rule at all — so the result says whether the app could actually vouch for
 * the ingredient, not only whether a rule fired.
 */
function checkLabel(value, preferences, knownIngredients) {
  const forms = labelForms(value)
  const allergens = selected(preferences?.allergies)
  const diets = selected(preferences?.diets).filter(key => DIET_EXCLUSIONS[key])
  const conflicts = []

  for (const key of allergens) {
    if (ALLERGEN_GROUPS[key] && forms.some(form => ALLERGEN_GROUPS[key].has(form))) {
      conflicts.push({ preference: key, kind: 'allergen' })
    }
  }
  for (const key of diets) {
    if (forms.some(form => DIET_EXCLUSIONS[key].has(form))) {
      conflicts.push({ preference: key, kind: 'diet' })
    }
  }

  const uncovered = allergens.filter(key => !ALLERGEN_GROUPS[key])
  const restrictions = allergens.length + diets.length
  const known = forms.some(form => knownIngredients.has(form))
  // With no restriction set there is nothing to be unsure about
  const verified = uncovered.length === 0 && (restrictions === 0 || known)

  const result = {
    ingredient: displayIngredientLabel(forms.find(form => knownIngredients.has(form)) ?? forms[0]),
    allowed: conflicts.length === 0,
    verified,
    conflicts,
    checked_preferences: [...allergens.filter(key => ALLERGEN_GROUPS[key]), ...diets],
  }

  if (uncovered.length > 0) {
    result.note = `The app has no ingredient rules for ${uncovered.join(', ')}, so it cannot confirm this ingredient is safe for this user.`
  } else if (!verified) {
    result.note = 'This ingredient is outside the app\'s ingredient rules, so the app cannot confirm it is safe for this user.'
  }

  return result
}

function checkIngredient(args, preferences, knownIngredients) {
  if (labelForms(args.ingredient).length === 0) {
    return { error: 'missing_ingredient', message: 'Pass the ingredient to check.' }
  }
  return checkLabel(args.ingredient, preferences, knownIngredients)
}

function bookSummary(result) {
  return {
    recipe_id: String(result.recipe.recipe_id),
    name: String(result.recipe.recipe_name ?? ''),
    meal_type: result.recipe.meal_type ?? null,
    coverage_score: Math.round(result.coverageScore),
    missing_ingredients: result.missingIngredients.map(displayIngredientLabel),
  }
}

function previewRecipes(ranked, args) {
  const maxMissing = optionalCount(args.max_missing_ingredients)
  const matches = ranked.filter(result => result.coverageScore > 0
    && (maxMissing === null || result.missingIngredients.length <= maxMissing))

  return {
    source: BOOK_SOURCE,
    strong_match_threshold: LOCAL_MATCH_THRESHOLD,
    total_matches: matches.length,
    strong_matches: matches.filter(result => result.coverageScore >= LOCAL_MATCH_THRESHOLD).length,
    recipes: matches.slice(0, MAX_FIND_RESULTS).map(bookSummary),
  }
}

/**
 * Which one ingredient would do the most for this list.
 *
 * For a recipe with m of its t ingredients on the list, adding one of its
 * missing ingredients raises coverage from m/t to (m+1)/t. A candidate unlocks
 * the recipe when that step crosses the strong-match threshold. Candidates are
 * ranked by recipes unlocked, then by total coverage gained, then by name, so
 * the order is deterministic. It is one pass over every recipe's missing list —
 * O(total missing ingredients) — with no re-ranking per candidate. Recipes the
 * user's filters rule out never enter the pass, so neither do their
 * ingredients.
 */
function suggestAdditions(ranked, args, check) {
  const threshold = LOCAL_MATCH_THRESHOLD
  const limit = Math.min(MAX_SUGGESTIONS, Math.max(1, optionalCount(args.max_suggestions) ?? DEFAULT_SUGGESTIONS))
  const candidates = new Map()

  for (const result of ranked) {
    const total = result.recipe.ingredients.length
    const matched = result.matchedIngredients.length
    if (total === 0) continue

    // Compared in whole numbers so 7 of 10 lands on exactly 70
    const unlocks = matched * 100 < threshold * total && (matched + 1) * 100 >= threshold * total

    for (const label of result.missingIngredients) {
      const entry = candidates.get(label) ?? { label, gain: 0, improved: 0, unlocked: [] }
      entry.gain += 100 / total
      entry.improved += 1
      if (unlocks) {
        entry.unlocked.push({
          recipe_id: String(result.recipe.recipe_id),
          name: String(result.recipe.recipe_name ?? ''),
          coverage_after: Math.round(((matched + 1) / total) * 100),
        })
      }
      candidates.set(label, entry)
    }
  }

  const ordered = [...candidates.values()].sort((left, right) => (
    right.unlocked.length - left.unlocked.length
    || right.gain - left.gain
    || left.label.localeCompare(right.label)
  ))

  const suggestions = []
  for (const entry of ordered) {
    if (suggestions.length >= limit) break
    const safety = check(entry.label)
    if (!safety.allowed) continue
    suggestions.push({
      ingredient: displayIngredientLabel(entry.label),
      recipes_unlocked: entry.unlocked.length,
      recipes_improved: entry.improved,
      unlocked_recipes: entry.unlocked.slice(0, 3),
      verified_safe: safety.verified,
      ...(safety.note ? { note: safety.note } : {}),
    })
  }

  return {
    source: BOOK_SOURCE,
    strong_match_threshold: threshold,
    strong_matches_now: ranked.filter(result => result.coverageScore >= threshold).length,
    suggestions,
  }
}

/**
 * Totals, not per serving: the serving count lives only on the quantity screen,
 * so the honest figure is what the list itself contains.
 */
function listNutrition(args, data, ingredients) {
  const list = (Array.isArray(ingredients) ? ingredients : [])
    .filter(item => normaliseIngredientLabel(item?.label))
  const single = args.ingredient != null && String(args.ingredient).trim() !== ''
  const chosen = single ? list.filter(item => sameIngredient(item.label, args.ingredient)) : list

  if (single && chosen.length === 0) {
    return {
      error: 'not_on_list',
      ingredient: String(args.ingredient),
      message: 'That ingredient is not on the user\'s list.',
    }
  }

  const basis = single
    ? `${displayIngredientLabel(chosen[0].label)} on the list, at the quantity entered`
    : 'the whole ingredient list, at the quantities entered'

  const result = calculateIngredientListNutrition({
    ingredients: chosen.map(item => ({ label: item.label, quantity: item.quantity, unit: item.unit })),
    servings: 1,
    ingredientNutrition: data.ingredientNutrition,
    ingredientPortions: data.ingredientPortions,
  })

  if (!result.available) {
    return {
      basis,
      available: false,
      reason: result.reason,
      unresolved_ingredients: (result.unresolvedIngredients ?? []).map(displayIngredientLabel),
    }
  }

  return {
    basis,
    available: true,
    partial: Boolean(result.partial),
    unresolved_ingredients: result.unresolvedIngredients.map(displayIngredientLabel),
    ingredients: result.ingredients.map(item => ({
      ingredient: displayIngredientLabel(item.ingredientLabel),
      grams: roundTo(item.grams, 0),
      estimated: Boolean(item.estimated),
    })),
    total: roundFigures(result.total),
    source: result.source,
  }
}

async function loadBookData() {
  const [recommendationData, nutritionData] = await Promise.all([
    loadRecommendationData(),
    loadNutritionCalculationData(),
  ])
  return {
    recipes: recommendationData.recipes,
    ingredientNutrition: recommendationData.ingredientNutrition,
    ingredientPortions: nutritionData.ingredientPortions,
  }
}

/**
 * Binds the stage's tools to one user's list and preferences for one chat
 * turn. `allowedRecipeIds()` is every recipe the tools have put in front of
 * the model so far — the recipes the guard may accept a citation for.
 */
export function createChatToolbox({
  stage = CHAT_STAGES.RECIPES,
  recommendationResult = null,
  preferences = {},
  ingredients = [],
  loadData = loadBookData,
} = {}) {
  const offered = STAGE_TOOLS[stage] ?? STAGE_TOOLS[CHAT_STAGES.RECIPES]
  const recipes = stage === CHAT_STAGES.RECIPES ? visibleRecipes(recommendationResult) : []
  const byId = new Map(recipes.map(recipe => [String(recipe.id), recipe]))
  const reachable = new Set(byId.keys())

  const baseKnown = new Set([
    ...Object.values(ALLERGEN_GROUPS).flatMap(group => [...group]),
    ...Object.values(DIET_EXCLUSIONS).flatMap(group => [...group]),
    ...recipes.flatMap(recipe => (recipe.ingredients ?? []).map(normaliseIngredientLabel)),
    ...(Array.isArray(ingredients) ? ingredients : [])
      .map(item => normaliseIngredientLabel(typeof item === 'string' ? item : item?.label)),
  ].filter(Boolean))

  let bookRequest = null
  const book = () => {
    bookRequest ??= Promise.resolve()
      .then(loadData)
      .then(data => ({
        data,
        ranked: matchRecipes({
          recipes: data.recipes,
          ingredients,
          preferences,
          ingredientNutrition: data.ingredientNutrition,
        }),
      }))
      .catch(error => {
        bookRequest = null
        throw error
      })
    return bookRequest
  }

  // The recipe book widens what counts as a known ingredient, when it loads
  const knownIngredients = async () => {
    if (stage !== CHAT_STAGES.INGREDIENTS) return baseKnown
    try {
      const { data } = await book()
      return new Set([
        ...baseKnown,
        ...data.recipes.flatMap(recipe => (recipe.ingredients ?? []).map(normaliseIngredientLabel)),
      ])
    } catch {
      return baseKnown
    }
  }

  const names = new Map(recipes.map(recipe => [String(recipe.id), String(recipe.name ?? '')]))
  const remember = items => items.forEach(item => {
    reachable.add(String(item.recipe_id))
    names.set(String(item.recipe_id), String(item.name ?? ''))
  })

  const withRecipe = handler => args => {
    const recipe = byId.get(String(args.recipe_id ?? ''))
    return recipe ? handler(recipe) : notOnList(args.recipe_id)
  }

  const handlers = {
    [TOOL_NAMES.FIND_RECIPES]: args => findRecipes(recipes, args),
    [TOOL_NAMES.GET_RECIPE_DETAILS]: withRecipe(packCandidate),
    [TOOL_NAMES.GET_RECIPE_NUTRITION]: withRecipe(recipeNutrition),
    [TOOL_NAMES.CHECK_INGREDIENT]: async args => checkIngredient(args, preferences, await knownIngredients()),
    [TOOL_NAMES.PREVIEW_RECIPES]: async args => {
      const { ranked } = await book()
      const result = previewRecipes(ranked, args)
      remember(result.recipes)
      return result
    },
    [TOOL_NAMES.SUGGEST_ADDITIONS]: async args => {
      const { ranked } = await book()
      const known = await knownIngredients()
      const result = suggestAdditions(ranked, args, label => checkLabel(label, preferences, known))
      result.suggestions.forEach(suggestion => remember(suggestion.unlocked_recipes))
      return result
    },
    [TOOL_NAMES.GET_LIST_NUTRITION]: async args => {
      const { data } = await book()
      return listNutrition(args, data, ingredients)
    },
    [TOOL_NAMES.GET_APP_HELP]: args => appHelp(args.topic),
  }

  return {
    stage,
    declarations: TOOL_DECLARATIONS.filter(declaration => offered.includes(declaration.name)),
    allowedRecipeIds: () => [...reachable],
    recipeNames: () => Object.fromEntries(names),
    async run(name, args) {
      if (!offered.includes(name) || !Object.hasOwn(handlers, name)) {
        return { error: 'unknown_tool', name: String(name ?? '') }
      }
      try {
        return await handlers[name](args && typeof args === 'object' ? args : {})
      } catch {
        return { error: 'tool_failed', name }
      }
    },
  }
}
