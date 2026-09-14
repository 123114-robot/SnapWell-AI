import { displayIngredientLabel } from '../recommendation/recommendationAdapter.js'
import { normalisePreference } from '../recommendation/preferenceRules.js'

export const CHAT_CONTEXT_VERSION = 'chat-v1'

/**
 * How many ranked recipes the model is allowed to see. The chat is a grounded
 * explainer, not a search engine: a short candidate list keeps the answer
 * anchored and the request small. The recipe the user is currently looking at
 * is added on top of this, so opening the eighth card never leaves the model
 * unable to talk about the screen the user is on.
 */
export const MAX_CANDIDATE_RECIPES = 5

const FALLBACK_NUTRITION_SOURCE = 'AUSNUT 2023 per-100g data with standard v1 portion estimates'

/**
 * Per-serving figures are renamed to carry their units, because the model reads
 * these as text and `protein: 12` invites "12 grams" or "12 percent" equally.
 * The app never renders these numbers from the model's reply — they are here so
 * it can reason about them, not so it can repeat them.
 */
function nutritionPerServing(nutrition) {
  const perServing = nutrition?.perServing
  if (!nutrition?.available || !perServing) return null
  return {
    kcal: perServing.kcal,
    protein_g: perServing.protein,
    carbs_g: perServing.carbs,
    fat_g: perServing.fat,
    fibre_g: perServing.fibre,
    sodium_mg: perServing.sodium,
  }
}

/**
 * One recipe, field by field. This is a whitelist on purpose: copying the
 * recommendation object wholesale would quietly forward whatever the app state
 * grows next — a cached photo, a bounding box — into an outbound request.
 */
function packRecipe(recipe) {
  const nutrition = recipe?.nutrition
  return {
    recipe_id: String(recipe?.id ?? ''),
    name: String(recipe?.name ?? ''),
    source: recipe?.source === 'online' ? 'online' : 'local',
    meal_type: recipe?.mealType ?? null,
    cuisine_style: recipe?.cuisineStyle ?? null,
    ingredients: Array.isArray(recipe?.ingredients) ? [...recipe.ingredients] : [],
    steps: Array.isArray(recipe?.steps) ? [...recipe.steps] : [],
    tags: Array.isArray(recipe?.tags) ? [...recipe.tags] : [],
    coverage_score: Number(recipe?.displayCoverageScore ?? Math.round(recipe?.coverageScore ?? 0)),
    matched_ingredients: Array.isArray(recipe?.matchedIngredients) ? [...recipe.matchedIngredients] : [],
    missing_ingredients: Array.isArray(recipe?.missingIngredients) ? [...recipe.missingIngredients] : [],
    // Saying "no nutrition data" outright beats omitting the field. A missing
    // key is an invitation to invent one; an explicit false is a fact.
    nutrition_available: Boolean(nutrition?.available),
    nutrition_per_serving: nutritionPerServing(nutrition),
    nutrition_partial: Boolean(nutrition?.available && nutrition?.partial),
    nutrition_unresolved: Array.isArray(nutrition?.unresolvedIngredients)
      ? [...nutrition.unresolvedIngredients]
      : [],
  }
}

function packIngredient(ingredient) {
  const label = String(ingredient?.label ?? '').trim().toLowerCase()
  return {
    label,
    display_name: displayIngredientLabel(label),
    quantity: Number(ingredient?.quantity ?? 1),
    unit: ingredient?.unit ?? 'piece',
    source: ingredient?.source ?? 'manual',
  }
}

function normalisedList(values) {
  return (Array.isArray(values) ? values : [])
    .map(normalisePreference)
    .filter(Boolean)
}

/**
 * Everything the verification layer enforces is normalised here, so the prompt
 * and the guard compare the same strings. Everything only the prompt reads is
 * left in the wording the user chose, which reads better in an instruction.
 */
function packPreferences(preferences) {
  return {
    diets: normalisedList(preferences?.diets),
    allergens: normalisedList(preferences?.allergies),
    goals: Array.isArray(preferences?.goals) ? [...preferences.goals] : [],
    meal_type: preferences?.mealType ?? null,
    cuisine_preference: preferences?.cuisinePreference ?? null,
  }
}

/**
 * Assembles the text-only context pack sent with a chat turn.
 *
 * Nothing derived from the camera reaches this object: no photo, no detection
 * run, no bounding boxes. Only the confirmed ingredient labels the user has
 * already seen and edited, their stated preferences, and recipes the local
 * engine has already ranked.
 */
export function buildChatContext({
  ingredients = [],
  preferences = {},
  recommendationResult = null,
  focusedRecipeId = null,
} = {}) {
  const ranked = Array.isArray(recommendationResult?.recommendations)
    ? recommendationResult.recommendations
    : []

  const candidates = ranked.slice(0, MAX_CANDIDATE_RECIPES)
  const focusedId = focusedRecipeId ? String(focusedRecipeId) : null

  if (focusedId && !candidates.some(recipe => String(recipe?.id) === focusedId)) {
    const focused = ranked.find(recipe => String(recipe?.id) === focusedId)
    if (focused) candidates.push(focused)
  }

  const packedRecipes = candidates.map(packRecipe).filter(recipe => recipe.recipe_id)

  const nutritionSource = ranked
    .map(recipe => recipe?.nutrition?.source)
    .find(source => typeof source === 'string' && source)
    ?? FALLBACK_NUTRITION_SOURCE

  return {
    version: CHAT_CONTEXT_VERSION,
    ingredients: (Array.isArray(ingredients) ? ingredients : [])
      .map(packIngredient)
      .filter(item => item.label),
    preferences: packPreferences(preferences),
    candidate_recipes: packedRecipes,
    focused_recipe_id: packedRecipes.some(recipe => recipe.recipe_id === focusedId)
      ? focusedId
      : null,
    nutrition_source: nutritionSource,
  }
}

/**
 * The recipe whitelist, read straight off the pack the model was given rather
 * than rebuilt from app state. One derivation, so the set the model can see and
 * the set the guard will accept cannot drift apart.
 */
export function candidateRecipeIds(context) {
  const recipes = Array.isArray(context?.candidate_recipes) ? context.candidate_recipes : []
  return recipes.map(recipe => recipe.recipe_id).filter(Boolean)
}
