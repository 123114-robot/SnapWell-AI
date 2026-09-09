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
 * The ingredient list an AI recipe should be costed on: what the user confirmed
 * (at the quantities they confirmed, so the numbers describe their own food)
 * plus the missing ingredients the recipe genuinely needs. Ingredients the AI
 * marked optional are left out — a garnish should not move a calorie count.
 */
function onlineRecipeIngredients(onlineRecipe, confirmedIngredients) {
  const confirmedByLabel = new Map()
  for (const ingredient of confirmedIngredients) {
    const label = normaliseIngredientLabel(
      typeof ingredient === 'string' ? ingredient : ingredient?.label,
    )
    if (label && !confirmedByLabel.has(label)) confirmedByLabel.set(label, ingredient)
  }

  const entries = []
  const seen = new Set()

  function add(rawLabel) {
    const label = normaliseIngredientLabel(rawLabel)
    if (!label || seen.has(label)) return
    seen.add(label)
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

  return entries
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
    const nutrition = calculateIngredientListNutrition({
      ingredients: onlineRecipeIngredients(onlineRecipe, ingredients),
      servings: servings ?? AI_DEFAULT_SERVINGS,
      ingredientNutrition: nutritionData.ingredientNutrition ?? data.ingredientNutrition,
      ingredientPortions: nutritionData.ingredientPortions,
    })

    return nutrition.available
      ? { ...nutrition, servingsAssumed: servings === null }
      : nutrition
  }

  // Attempt Online Recommendation when local matching is below threshold and ingredients are present
  if (fallbackRequired && confirmedIngredientLabels.length > 0) {
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
      const localTopUp = localRecommendations
        .filter(item => item.coverageScore > 0)
        .slice(0, LOCAL_TOP_UP_COUNT)

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
    },
  }
}

export default recommendationEngine
