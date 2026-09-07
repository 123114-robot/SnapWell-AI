import {
  getCuisineMatchScore,
  getHealthGoalMatchScore,
  getPreferenceFit,
  recipePassesHardFilters,
} from './preferenceRules.js'

export function normaliseIngredientLabel(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function createIngredientAliasMap(ingredientNutrition = {}) {
  const items = Array.isArray(ingredientNutrition?.items) ? ingredientNutrition.items : []
  const aliasMap = new Map()

  items.forEach(item => {
    const canonicalLabel = normaliseIngredientLabel(item?.label)
    if (canonicalLabel) aliasMap.set(canonicalLabel, canonicalLabel)
  })

  items.forEach(item => {
    const canonicalLabel = normaliseIngredientLabel(item?.label)
    if (!canonicalLabel) return

    const aliases = [
      ...(Array.isArray(item.aliases) ? item.aliases : []),
      ...(Array.isArray(item.ocr_keywords) ? item.ocr_keywords : []),
    ]

    aliases.forEach(alias => {
      const normalisedAlias = normaliseIngredientLabel(alias)
      if (normalisedAlias && !aliasMap.has(normalisedAlias)) {
        aliasMap.set(normalisedAlias, canonicalLabel)
      }
    })
  })

  return aliasMap
}

export function normaliseConfirmedIngredients(ingredients = [], aliasMap = new Map()) {
  if (!Array.isArray(ingredients)) return []

  const labels = ingredients.map(ingredient => {
    const rawLabel = typeof ingredient === 'string' ? ingredient : ingredient?.label
    const normalisedLabel = normaliseIngredientLabel(rawLabel)
    return aliasMap.get(normalisedLabel) ?? normalisedLabel
  }).filter(Boolean)

  return [...new Set(labels)]
}

function canonicaliseRecipeIngredients(recipe, aliasMap) {
  if (!Array.isArray(recipe?.ingredients)) return []

  const labels = recipe.ingredients.map(ingredient => {
    const normalisedLabel = normaliseIngredientLabel(ingredient)
    return aliasMap.get(normalisedLabel) ?? normalisedLabel
  }).filter(Boolean)

  return [...new Set(labels)]
}

function compareRecipeIds(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

export function matchRecipes({
  recipes = [],
  ingredients = [],
  preferences = {},
  ingredientNutrition = {},
} = {}) {
  const aliasMap = createIngredientAliasMap(ingredientNutrition)
  const confirmedIngredients = normaliseConfirmedIngredients(ingredients, aliasMap)
  const confirmedSet = new Set(confirmedIngredients)

  const ranked = (Array.isArray(recipes) ? recipes : []).flatMap(recipe => {
    const recipeIngredients = canonicaliseRecipeIngredients(recipe, aliasMap)
    if (!recipe?.recipe_id || recipeIngredients.length === 0) return []

    const canonicalRecipe = { ...recipe, ingredients: recipeIngredients }
    if (!recipePassesHardFilters(canonicalRecipe, preferences)) return []

    const matchedIngredients = recipeIngredients.filter(ingredient => confirmedSet.has(ingredient))
    const missingIngredients = recipeIngredients.filter(ingredient => !confirmedSet.has(ingredient))
    const coverageScore = (matchedIngredients.length / recipeIngredients.length) * 100

    return [{
      recipe: canonicalRecipe,
      coverageScore,
      matchedIngredients,
      missingIngredients,
      preferenceFit: getPreferenceFit(canonicalRecipe, preferences),
      _healthGoalScore: getHealthGoalMatchScore(canonicalRecipe, preferences),
      _cuisineScore: getCuisineMatchScore(canonicalRecipe, preferences),
    }]
  })

  ranked.sort((left, right) => (
    right.coverageScore - left.coverageScore
    || right._healthGoalScore - left._healthGoalScore
    || right._cuisineScore - left._cuisineScore
    || left.missingIngredients.length - right.missingIngredients.length
    || compareRecipeIds(left.recipe.recipe_id, right.recipe.recipe_id)
  ))

  return ranked.map(rankedResult => {
    const result = { ...rankedResult }
    delete result._healthGoalScore
    delete result._cuisineScore
    return result
  })
}
