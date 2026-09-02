function displayIngredientLabel(label) {
  return String(label ?? '').replace(/_/g, ' ').trim()
}

export function adaptLocalRecommendation(result) {
  const recipe = result?.recipe ?? {}

  return {
    id: recipe.recipe_id,
    name: recipe.recipe_name,
    mealType: recipe.meal_type,
    cuisineStyle: recipe.cuisine_style,
    ingredients: Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [],
    steps: Array.isArray(recipe.steps) ? [...recipe.steps] : [],
    tags: Array.isArray(recipe.dietary_tags) ? [...recipe.dietary_tags] : [],
    notes: recipe.notes ?? '',
    coverageScore: result?.coverageScore ?? 0,
    displayCoverageScore: Math.round(result?.coverageScore ?? 0),
    matchedIngredients: Array.isArray(result?.matchedIngredients)
      ? [...result.matchedIngredients]
      : [],
    missingIngredients: Array.isArray(result?.missingIngredients)
      ? [...result.missingIngredients]
      : [],
    preferenceFit: result?.preferenceFit ?? {
      healthGoalMatch: false,
      cuisineMatch: false,
    },
    nutrition: result?.nutrition ?? {
      available: false,
      estimated: true,
      reason: 'Nutrition information is unavailable for this recipe.',
      unresolvedIngredients: [],
    },
    source: 'local',
  }
}

export function adaptRecommendationResult(engineResult) {
  return {
    ...engineResult,
    recommendations: Array.isArray(engineResult?.recommendations)
      ? engineResult.recommendations.map(adaptLocalRecommendation)
      : [],
  }
}

export function createMissingIngredientLinks(label, linkData) {
  const query = encodeURIComponent(displayIngredientLabel(label))
  const providers = linkData?.providers
  if (!providers || typeof providers !== 'object') return []

  return Object.entries(providers).flatMap(([id, provider]) => {
    if (!provider?.name || !provider?.search_url_template) return []
    return [{
      id,
      store: provider.name,
      url: provider.search_url_template.replace('{query}', query),
    }]
  })
}

export { displayIngredientLabel }
