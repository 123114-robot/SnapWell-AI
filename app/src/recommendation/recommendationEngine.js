import { loadNutritionCalculationData, loadRecommendationData, loadMissingIngredientLinks } from './foodDataService.js'
import {
  matchRecipes,
  normaliseConfirmedIngredients,
  createIngredientAliasMap,
  normaliseIngredientLabel,
} from './recipeMatcher.js'
import { calculateIngredientListNutrition, calculateRecipeNutrition } from './nutritionService.js'
import { adaptLocalRecommendation, adaptOnlineRecommendation } from './recommendationAdapter.js'
import {
  buildAiInputPayload,
  generateOnlineRecommendations,
  ONLINE_SERVICE_ERROR_MESSAGE,
} from './geminiService.js'

export const LOCAL_MATCH_THRESHOLD = 70

/**
 * Used when an AI recipe comes back without a usable `servings` count. Every
 * recipe in the local v1 dataset serves two, so two is the house assumption
 * rather than a number invented per recipe. The result records that it was
 * assumed so the Nutrition screen can say so.
 */
export const AI_DEFAULT_SERVINGS = 2

/**
 * How many local recipes ride along behind the AI ones. Going online means the
 * best local match was below the threshold, not that the recipe book is
 * useless — a 60%-covered real recipe is often more cookable than a generated
 * one, so the list keeps a few instead of dropping them.
 */
export const LOCAL_TOP_UP_COUNT = 3

function positiveInteger(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

/**
 * Upper bound on one ingredient's weight in an AI recipe. A figure outside
 * (0, 5 kg] is a slip rather than an amount, so that ingredient falls back to
 * the estimate below instead of skewing the whole total.
 */
export const MAX_AI_INGREDIENT_GRAMS = 5000

/**
 * AI labels arrive as written — "eggs", "Tomatoes" — so each is matched to the
 * label the AUSNUT table knows, trying the singular before giving up.
 */
function canonicalIngredientLabel(rawLabel, aliasMap) {
  const label = normaliseIngredientLabel(rawLabel)
  if (!label || !aliasMap) return label
  const forms = [label]
  if (label.endsWith('es')) forms.push(label.slice(0, -2))
  if (label.endsWith('s')) forms.push(label.slice(0, -1))
  const known = forms.find(form => aliasMap.has(form))
  return known ? aliasMap.get(known) : label
}

/**
 * The ingredient list an AI recipe should be costed on: every ingredient the
 * recipe uses, plus the missing ingredients it genuinely needs. Ingredients the
 * AI marked optional are left out — a garnish should not move a calorie count.
 *
 * Amounts come from the recipe itself: the AI gives grams for the whole recipe
 * as written, which is what makes the per-serving figures describe that dish.
 * An ingredient without a usable weight falls back to what the user confirmed,
 * or to one standard portion, and the result records that the figures are then
 * an estimate rather than the recipe's own.
 */
function onlineRecipeIngredients(onlineRecipe, confirmedIngredients, aliasMap = null) {
  const confirmedByLabel = new Map()
  for (const ingredient of confirmedIngredients) {
    const label = canonicalIngredientLabel(
      typeof ingredient === 'string' ? ingredient : ingredient?.label,
      aliasMap,
    )
    if (label && !confirmedByLabel.has(label)) confirmedByLabel.set(label, ingredient)
  }

  const recipeGrams = new Map()
  const quantities = Array.isArray(onlineRecipe?.ingredient_quantities) ? onlineRecipe.ingredient_quantities : []
  for (const entry of quantities) {
    const label = canonicalIngredientLabel(entry?.label, aliasMap)
    const grams = Number(entry?.grams)
    if (!label || recipeGrams.has(label)) continue
    if (Number.isFinite(grams) && grams > 0 && grams <= MAX_AI_INGREDIENT_GRAMS) recipeGrams.set(label, grams)
  }

  const entries = []
  const seen = new Set()
  let estimated = 0

  function add(rawLabel) {
    const label = canonicalIngredientLabel(rawLabel, aliasMap)
    if (!label || seen.has(label)) return
    seen.add(label)

    if (recipeGrams.has(label)) {
      entries.push({ ingredient_label: label, quantity_g: recipeGrams.get(label) })
      return
    }

    estimated += 1
    const confirmed = confirmedByLabel.get(label)
    entries.push(confirmed && typeof confirmed === 'object'
      ? { ...confirmed, ingredient_label: label }
      : { ingredient_label: label })
  }

  const used = Array.isArray(onlineRecipe?.used_ingredients) ? onlineRecipe.used_ingredients : []
  used.forEach(item => add(typeof item === 'string' ? item : item?.label))

  const missing = Array.isArray(onlineRecipe?.missing_ingredients) ? onlineRecipe.missing_ingredients : []
  missing.forEach(item => {
    if (typeof item === 'string') return add(item)
    if (item?.optional) return
    add(item?.label)
  })

  return { entries, quantitiesFromRecipe: entries.length > 0 && estimated === 0 }
}

function safePreferences(preferences) {
  return preferences && typeof preferences === 'object'
    ? preferences
    : {}
}

export async function recommendationEngine(input = {}, dataOverride = null, options = {}) {
  const data = dataOverride ?? await loadRecommendationData()
  const ingredients = Array.isArray(input?.ingredients) ? input.ingredients : []
  const preferences = safePreferences(input?.preferences)
  const matches = matchRecipes({
    recipes: data.recipes,
    ingredientNutrition: data.ingredientNutrition,
    ingredients,
    preferences,
  })
  let nutritionData = null
  let linkData = null

  if (dataOverride) {
    const hasNutritionData = dataOverride.recipeIngredientMap
      && dataOverride.ingredientPortions
      && dataOverride.recipePortions
    nutritionData = hasNutritionData ? dataOverride : null
    linkData = dataOverride.missingIngredientLinks ?? null
  } else {
    try {
      nutritionData = await loadNutritionCalculationData()
    } catch {
      nutritionData = null
    }
    try {
      linkData = await loadMissingIngredientLinks()
    } catch {
      linkData = null
    }
  }

  const rawLocalResults = matches.map(result => ({
    ...result,
    nutrition: nutritionData
      ? calculateRecipeNutrition({
        recipeId: result.recipe.recipe_id,
        ...nutritionData,
      })
      : {
        available: false,
        estimated: true,
        reason: 'Nutrition reference data could not be loaded.',
        unresolvedIngredients: [],
      },
  }))

  const aliasMap = createIngredientAliasMap(data.ingredientNutrition)
  const confirmedIngredientLabels = normaliseConfirmedIngredients(ingredients, aliasMap)
  const topCoverageScore = rawLocalResults[0]?.coverageScore ?? 0
  const fallbackRequired = rawLocalResults.length === 0
    || topCoverageScore < LOCAL_MATCH_THRESHOLD

  const localRecommendations = rawLocalResults.map(item => adaptLocalRecommendation(item, linkData))

  function onlineRecipeNutrition(onlineRecipe) {
    if (!nutritionData) {
      return {
        available: false,
        estimated: true,
        reason: 'Nutrition reference data could not be loaded.',
        unresolvedIngredients: [],
      }
    }

    const servings = positiveInteger(onlineRecipe?.servings)
    const { entries, quantitiesFromRecipe } = onlineRecipeIngredients(onlineRecipe, ingredients, aliasMap)
    const nutrition = calculateIngredientListNutrition({
      ingredients: entries,
      servings: servings ?? AI_DEFAULT_SERVINGS,
      ingredientNutrition: nutritionData.ingredientNutrition ?? data.ingredientNutrition,
      ingredientPortions: nutritionData.ingredientPortions,
    })

    return nutrition.available
      ? { ...nutrition, servingsAssumed: servings === null, quantitiesFromRecipe }
      : nutrition
  }

  // Local mode never leaves the device: the local list is the answer even
  // when its best match is below the threshold. Callers opt out explicitly, so
  // leaving the option out keeps the existing hybrid behaviour.
  const allowOnline = options?.allowOnline !== false

  // Attempt Online Recommendation when local matching is below threshold and ingredients are present
  if (allowOnline && fallbackRequired && confirmedIngredientLabels.length > 0) {
    const onlineGenerator = options?.generateOnlineRecommendations ?? generateOnlineRecommendations
    const inputPayload = buildAiInputPayload({
      ingredients,
      preferences,
      ingredientNutrition: data.ingredientNutrition,
      ingredientPortions: nutritionData?.ingredientPortions ?? dataOverride?.ingredientPortions ?? null,
      linkData,
    })

  let onlineResult = null
      try {
        onlineResult = await onlineGenerator({
          inputPayload,
          apiKey: options?.apiKey,
          timeoutMs: options?.timeoutMs,
          fetchFn: options?.fetchFn,
        })
      } catch {
        // onlineResult remains null so execution flows into the local fallback block
      }

    if (onlineResult?.success) {
      // The AI is told never to invent nutrition values, so an AI recipe arrives
      // with ingredient labels and a serving count and nothing else. Costing it
      // here against AUSNUT is what makes its Nutrition screen real.
      const onlineRecommendations = onlineResult.data.recommendations.map(onlineItem =>
        adaptOnlineRecommendation(
          { ...onlineItem, nutrition: onlineRecipeNutrition(onlineItem) },
          linkData,
        ),
      )

      // Recipes sharing nothing with the confirmed list are not a match at any
      // rank, so they are dropped before the top-up is taken rather than after.
      // Online mode in the app shows generated recipes on their own and passes
      // 0 here; leaving the option out keeps the mixed list.
      const localTopUpCount = Number.isInteger(options?.localTopUpCount) && options.localTopUpCount >= 0
        ? options.localTopUpCount
        : LOCAL_TOP_UP_COUNT
      const localTopUp = localRecommendations
        .filter(item => item.coverageScore > 0)
        .slice(0, localTopUpCount)

      return {
        mode: 'online',
        source: 'online',
        threshold: LOCAL_MATCH_THRESHOLD,
        fallbackRequired,
        topCoverageScore,
        recommendations: [...onlineRecommendations, ...localTopUp],
        inputContext: {
          ingredients,
          preferences,
          confirmedIngredientLabels,
        },
        diagnostics: {
          eligibleRecipeCount: onlineRecommendations.length + localTopUp.length,
          onlineRecipeCount: onlineRecommendations.length,
          localTopUpCount: localTopUp.length,
          confirmedIngredientCount: confirmedIngredientLabels.length,
          onlineRecommendationStatus: 'success',
          localRecommendations,
          assumptions: onlineResult.data.summary?.assumptions ?? [],
        },
      }
    }

    // If online service fails, timed out, or unconfigured, gracefully fallback to local recipes
    return {
      mode: 'local',
      source: 'local',
      threshold: LOCAL_MATCH_THRESHOLD,
      fallbackRequired,
      topCoverageScore,
      recommendations: localRecommendations,
      inputContext: {
        ingredients,
        preferences,
        confirmedIngredientLabels,
      },
      diagnostics: {
        eligibleRecipeCount: localRecommendations.length,
        confirmedIngredientCount: confirmedIngredientLabels.length,
        onlineRecommendationStatus: 'failed',
        onlineRecommendationNote: ONLINE_SERVICE_ERROR_MESSAGE,
        localRecommendations,
      },
    }
  }

  return {
    mode: 'local',
    source: 'local',
    threshold: LOCAL_MATCH_THRESHOLD,
    fallbackRequired,
    topCoverageScore,
    recommendations: localRecommendations,
    inputContext: {
      ingredients,
      preferences,
      confirmedIngredientLabels,
    },
    diagnostics: {
      eligibleRecipeCount: localRecommendations.length,
      confirmedIngredientCount: confirmedIngredientLabels.length,
      ...(allowOnline ? {} : { onlineRecommendationStatus: 'disabled' }),
    },
  }
}

export default recommendationEngine
