export const CUISINE_OPTIONS = Object.freeze([
  'Asian-inspired',
  'Australian cafe',
  'Australian everyday',
  'BBQ and roast',
  'Indian-inspired',
  'Italian-inspired',
  'Mediterranean-inspired',
  'Thai-inspired',
])

export const MEAL_TYPE_OPTIONS = Object.freeze([
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
  'Side',
])

const MEAT_AND_SEAFOOD = new Set([
  'bacon',
  'beef_mince',
  'chicken_breast',
  'chicken_thigh',
  'pork',
  'prawn',
  'salmon',
  'sausage',
])

const DAIRY = new Set(['butter', 'cheese', 'milk', 'yoghurt'])
const EGGS = new Set(['egg'])
const GLUTEN = new Set(['bread', 'flour', 'noodles', 'pasta', 'tortilla', 'soy_sauce'])
const NUTS = new Set(['peanut_butter'])
const SHELLFISH = new Set(['prawn'])
const SOY = new Set(['soy_sauce', 'tofu'])

const VEGAN_EXCLUSIONS = new Set([
  ...MEAT_AND_SEAFOOD,
  ...DAIRY,
  ...EGGS,
])

const SOFT_TAG_MAPPINGS = new Map([
  ['low_calorie', 'low-calorie'],
  ['high_protein', 'high-protein'],
  ['weight_loss', 'low-calorie'],
  ['muscle_gain', 'high-protein'],
])

function normalisePreference(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normaliseIngredient(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function hasAnyIngredient(recipeIngredients, excludedIngredients) {
  return recipeIngredients.some(ingredient => excludedIngredients.has(ingredient))
}

function selectedValues(preferences, key) {
  return Array.isArray(preferences?.[key])
    ? preferences[key].map(normalisePreference).filter(Boolean)
    : []
}

export function recipePassesHardFilters(recipe, preferences = {}) {
  const recipeIngredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients.map(normaliseIngredient)
    : []
  const diets = new Set(selectedValues(preferences, 'diets'))
  const allergies = new Set(selectedValues(preferences, 'allergies'))

  if (diets.has('vegetarian') && hasAnyIngredient(recipeIngredients, MEAT_AND_SEAFOOD)) return false
  if (diets.has('vegan') && hasAnyIngredient(recipeIngredients, VEGAN_EXCLUSIONS)) return false
  if (diets.has('gluten_free') && hasAnyIngredient(recipeIngredients, GLUTEN)) return false
  if (diets.has('dairy_free') && hasAnyIngredient(recipeIngredients, DAIRY)) return false

  if (allergies.has('no_nuts') && hasAnyIngredient(recipeIngredients, NUTS)) return false
  if (allergies.has('no_shellfish') && hasAnyIngredient(recipeIngredients, SHELLFISH)) return false
  if (allergies.has('no_eggs') && hasAnyIngredient(recipeIngredients, EGGS)) return false
  if (allergies.has('no_soy') && hasAnyIngredient(recipeIngredients, SOY)) return false

  const requestedMealType = normalisePreference(preferences?.mealType)
  if (requestedMealType && normalisePreference(recipe?.meal_type) !== requestedMealType) return false

  return true
}

export function getHealthGoalMatchScore(recipe, preferences = {}) {
  const requestedTags = new Set()
  const softPreferences = [
    ...selectedValues(preferences, 'diets'),
    ...selectedValues(preferences, 'goals'),
  ]

  softPreferences.forEach(value => {
    const mappedTag = SOFT_TAG_MAPPINGS.get(value)
    if (mappedTag) requestedTags.add(mappedTag)
  })

  const recipeTags = new Set(
    Array.isArray(recipe?.dietary_tags)
      ? recipe.dietary_tags.map(tag => String(tag).trim().toLowerCase())
      : [],
  )

  return [...requestedTags].filter(tag => recipeTags.has(tag)).length
}

export function getCuisineMatchScore(recipe, preferences = {}) {
  const requestedCuisine = normalisePreference(preferences?.cuisinePreference)
  if (!requestedCuisine) return 0
  return normalisePreference(recipe?.cuisine_style) === requestedCuisine ? 1 : 0
}

export function getPreferenceFit(recipe, preferences = {}) {
  return {
    healthGoalMatch: getHealthGoalMatchScore(recipe, preferences) > 0,
    cuisineMatch: getCuisineMatchScore(recipe, preferences) > 0,
  }
}
