function displayIngredientLabel(label) {
  return String(label ?? '').replace(/_/g, ' ').trim()
}

export function createMissingIngredientLinks(label, linkData = null) {
  const query = encodeURIComponent(displayIngredientLabel(label))
  const providers = linkData?.providers
  if (providers && typeof providers === 'object') {
    return Object.entries(providers).flatMap(([id, provider]) => {
      if (!provider?.name || !provider?.search_url_template) return []
      return [{
        id,
        store: provider.name,
        url: provider.search_url_template.replace('{query}', query),
      }]
    })
  }

  return [
    {
      id: 'coles',
      store: 'Coles',
      url: `https://www.coles.com.au/search/products?q=${query}`,
    },
    {
      id: 'woolworths',
      store: 'Woolworths',
      url: `https://www.woolworths.com.au/shop/search/products?searchTerm=${query}`,
    },
  ]
}

export function adaptLocalRecommendation(result, linkData = null) {
  if (result && result.source === 'local' && Array.isArray(result.missingIngredientDetails)) {
    return result
  }

  const recipe = result?.recipe ?? result ?? {}
  const matchedIngredients = Array.isArray(result?.matchedIngredients)
    ? [...result.matchedIngredients]
    : []
  const missingIngredients = Array.isArray(result?.missingIngredients)
    ? [...result.missingIngredients]
    : []

  const missingIngredientDetails = missingIngredients.map(label => ({
    label,
    displayName: displayIngredientLabel(label),
    optional: false,
    reason: 'Standard recipe ingredient',
    shoppingLinks: createMissingIngredientLinks(label, linkData),
  }))

  const coverageScore = Number(result?.coverageScore ?? (
    recipe.ingredients?.length
      ? (matchedIngredients.length / recipe.ingredients.length) * 100
      : 0
  ))

  return {
    id: recipe.recipe_id ?? recipe.id ?? 'UNKNOWN',
    name: recipe.recipe_name ?? recipe.name ?? 'Untitled Recipe',
    mealType: recipe.meal_type ?? recipe.mealType ?? 'dinner',
    cuisineStyle: recipe.cuisine_style ?? recipe.cuisineStyle ?? 'Australian everyday',
    ingredients: Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [],
    steps: Array.isArray(recipe.steps) ? [...recipe.steps] : [],
    tags: Array.isArray(recipe.dietary_tags ?? recipe.tags) ? [...(recipe.dietary_tags ?? recipe.tags)] : [],
    notes: recipe.notes ?? '',
    recommendationReason: recipe.notes || `Matches ${matchedIngredients.length} confirmed ingredient${matchedIngredients.length === 1 ? '' : 's'}.`,
    coverageScore,
    displayCoverageScore: Math.round(coverageScore),
    matchedIngredients,
    missingIngredients,
    missingIngredientDetails,
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

export function adaptOnlineRecommendation(onlineRecipe, linkData = null) {
  if (onlineRecipe && onlineRecipe.source === 'online' && Array.isArray(onlineRecipe.missingIngredientDetails)) {
    return onlineRecipe
  }

  const matched = Array.isArray(onlineRecipe?.used_ingredients)
    ? [...onlineRecipe.used_ingredients]
    : Array.isArray(onlineRecipe?.matchedIngredients)
      ? [...onlineRecipe.matchedIngredients]
      : []

  const rawMissing = Array.isArray(onlineRecipe?.missing_ingredients)
    ? onlineRecipe.missing_ingredients
    : Array.isArray(onlineRecipe?.missingIngredients)
      ? onlineRecipe.missingIngredients
      : []

  const missingIngredientDetails = rawMissing.map(item => {
    if (typeof item === 'string') {
      return {
        label: item,
        displayName: displayIngredientLabel(item),
        optional: false,
        reason: 'Suggested complementary ingredient',
        shoppingLinks: createMissingIngredientLinks(item, linkData),
      }
    }

    const label = String(item?.label ?? '').trim()
    const displayName = item?.display_name || displayIngredientLabel(label)
    const links = item?.shopping_links && typeof item.shopping_links === 'object'
      ? Object.entries(item.shopping_links).map(([id, url]) => ({
        id,
        store: id === 'coles' ? 'Coles' : (id === 'woolworths' ? 'Woolworths' : id),
        url: String(url),
      }))
      : createMissingIngredientLinks(label, linkData)

    return {
      label,
      displayName,
      optional: Boolean(item?.optional),
      reason: item?.reason || 'Suggested complementary ingredient',
      shoppingLinks: links,
    }
  })

  const missingIngredients = missingIngredientDetails.map(item => item.label)
  const totalIngredients = Array.isArray(onlineRecipe?.ingredients)
    ? [...onlineRecipe.ingredients]
    : [...new Set([...matched, ...missingIngredients])]

  const totalCount = matched.length + missingIngredients.length
  const coverageScore = totalCount > 0
    ? (matched.length / totalCount) * 100
    : 0

  return {
    id: onlineRecipe?.recipe_id ?? onlineRecipe?.id ?? 'AI001',
    name: onlineRecipe?.recipe_name ?? onlineRecipe?.name ?? 'AI Recipe',
    mealType: onlineRecipe?.meal_type ?? onlineRecipe?.mealType ?? 'dinner',
    cuisineStyle: onlineRecipe?.cuisine_style ?? onlineRecipe?.cuisineStyle ?? 'Australian everyday',
    ingredients: totalIngredients,
    steps: Array.isArray(onlineRecipe?.steps) ? [...onlineRecipe.steps] : [],
    tags: Array.isArray(onlineRecipe?.dietary_tags ?? onlineRecipe?.tags) ? [...(onlineRecipe.dietary_tags ?? onlineRecipe.tags)] : [],
    notes: onlineRecipe?.notes ?? '',
    recommendationReason: onlineRecipe?.recommendation_reason || 'AI-generated recipe tailored to your ingredients and preferences.',
    coverageScore,
    displayCoverageScore: Math.round(coverageScore),
    matchedIngredients: matched,
    missingIngredients,
    missingIngredientDetails,
    preferenceFit: {
      healthGoalMatch: true,
      cuisineMatch: true,
    },
    nutrition: onlineRecipe?.nutrition ?? {
      available: false,
      estimated: true,
      reason: onlineRecipe?.nutrition_note || 'Nutrition values should be calculated from AUSNUT data by the app.',
      unresolvedIngredients: [],
    },
    source: 'online',
  }
}


export function adaptRecommendation(item, linkData = null) {
  if (!item || typeof item !== 'object') return null
  if (item.source === 'online' || item.used_ingredients || (typeof item.recipe_id === 'string' && item.recipe_id.startsWith('AI'))) {
    return adaptOnlineRecommendation(item, linkData)
  }
  return adaptLocalRecommendation(item, linkData)
}

export function adaptRecommendationResult(engineResult, linkData = null) {
  const confirmedLabels = engineResult?.inputContext?.confirmedIngredientLabels ?? []
  const rawRecommendations = Array.isArray(engineResult?.recommendations)
    ? engineResult.recommendations
    : []

  const recommendations = rawRecommendations
    .map(item => adaptRecommendation(item, linkData, confirmedLabels))
    .filter(Boolean)

  return {
    ...engineResult,
    source: engineResult?.source ?? (engineResult?.mode === 'online' ? 'online' : 'local'),
    recommendations,
  }
}

export { displayIngredientLabel }
