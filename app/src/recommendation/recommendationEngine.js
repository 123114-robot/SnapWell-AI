import { loadNutritionCalculationData, loadRecommendationData, loadMissingIngredientLinks } from './foodDataService.js'
import { matchRecipes, normaliseConfirmedIngredients, createIngredientAliasMap } from './recipeMatcher.js'
import { calculateRecipeNutrition } from './nutritionService.js'
import { adaptLocalRecommendation, adaptOnlineRecommendation } from './recommendationAdapter.js'
import {
  buildAiInputPayload,
  generateOnlineRecommendations,
  ONLINE_SERVICE_ERROR_MESSAGE,
} from './geminiService.js'

export const LOCAL_MATCH_THRESHOLD = 70

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
      } catch (error) {
        // onlineResult remains null so execution flows into the local fallback block
      }

    if (onlineResult?.success) {
      const onlineRecommendations = onlineResult.data.recommendations.map(onlineItem =>
        adaptOnlineRecommendation(onlineItem, linkData),
      )

      return {
        mode: 'online',
        source: 'online',
        threshold: LOCAL_MATCH_THRESHOLD,
        fallbackRequired,
        topCoverageScore,
        recommendations: onlineRecommendations,
        inputContext: {
          ingredients,
          preferences,
          confirmedIngredientLabels,
        },
        diagnostics: {
          eligibleRecipeCount: onlineRecommendations.length,
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
