import { normaliseIngredientLabel } from './recipeMatcher.js'

const NUTRIENT_FIELDS = Object.freeze({
  energy_kcal: 'kcal',
  protein_g: 'protein',
  carbs_g: 'carbs',
  fat_g: 'fat',
  fibre_g: 'fibre',
  sodium_mg: 'sodium',
})

const NUTRITION_SOURCE = 'AUSNUT 2023 per-100g data with standard v1 portion estimates'

const UNIT_ALIASES = Object.freeze({
  gram: 'g',
  grams: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  pieces: 'piece',
  pcs: 'piece',
  each: 'piece',
  slices: 'slice',
  cups: 'cup',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cloves: 'clove',
})

function normaliseUnit(unit) {
  const value = String(unit ?? '').trim().toLowerCase()
  return UNIT_ALIASES[value] ?? value
}

function positiveNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function roundNutrient(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function emptyNutrients() {
  return {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    sodium: 0,
  }
}

export function convertQuantityToGrams(ingredient, ingredientPortions) {
  const explicitGrams = positiveNumber(ingredient?.quantity_g)
  if (explicitGrams !== null) {
    return {
      grams: explicitGrams,
      method: 'explicit-grams',
      estimated: false,
      fallbackUsed: false,
    }
  }

  const label = String(ingredient?.ingredient_label ?? ingredient?.label ?? '').trim()
  const portion = ingredientPortions?.portions?.[label]
  const suppliedQuantity = positiveNumber(ingredient?.quantity)
  // With no quantity given — an AI recipe naming an ingredient, say — fall back
  // to the portion's own standard amount. `default_quantity` exists because a
  // gram-based ingredient such as beef mince would otherwise default to 1 g.
  const defaultQuantity = portion
    ? positiveNumber(portion.default_quantity) ?? 1
    : null
  const quantity = suppliedQuantity ?? defaultQuantity
  const unit = normaliseUnit(ingredient?.unit ?? portion?.default_unit)

  if (quantity === null) return null

  // A quantity we supplied ourselves is an estimate, whatever the unit.
  const fellBack = suppliedQuantity === null
  if (unit === 'g') {
    return {
      grams: quantity,
      method: fellBack ? 'default-standard-portion' : 'grams',
      estimated: fellBack,
      fallbackUsed: fellBack,
    }
  }
  if (unit === 'kg') {
    return {
      grams: quantity * 1000,
      method: fellBack ? 'default-standard-portion' : 'kilograms',
      estimated: fellBack,
      fallbackUsed: fellBack,
    }
  }

  const gramsPerUnit = positiveNumber(portion?.unit_grams?.[unit])
    ?? (unit === normaliseUnit(portion?.default_unit)
      ? positiveNumber(portion?.grams_per_unit)
      : null)

  if (gramsPerUnit === null) return null

  return {
    grams: quantity * gramsPerUnit,
    method: suppliedQuantity === null ? 'default-standard-portion' : 'standard-unit-conversion',
    estimated: true,
    fallbackUsed: suppliedQuantity === null,
  }
}

function unavailable(reason, { unmatched = [], unestimated = [] } = {}) {
  return {
    available: false,
    estimated: true,
    reason,
    unresolvedIngredients: [...unmatched, ...unestimated],
    unmatchedIngredients: unmatched,
    unestimatedIngredients: unestimated,
  }
}

/**
 * Sums per-100 g AUSNUT values over already-resolved ingredients.
 *
 * `allowPartial` separates the two callers. A curated local recipe that cannot
 * resolve an ingredient has a data bug, so it reports nothing rather than a
 * total that silently omits food. An AI recipe will regularly name something
 * outside the 51 mapped ingredients, so it reports what it can and names what
 * it left out, which the Nutrition screen shows next to the numbers.
 */
function summariseNutrition({ resolved, unmatched = [], unestimated = [], servings, allowPartial = false }) {
  const unmatchedLabels = [...unmatched]
  const ingredientResults = []
  const total = emptyNutrients()

  for (const entry of resolved) {
    const calculated = emptyNutrients()
    let nutrientsValid = true
    for (const [sourceField, targetField] of Object.entries(NUTRIENT_FIELDS)) {
      const perHundredGrams = Number(entry.nutrition[sourceField])
      if (!Number.isFinite(perHundredGrams)) {
        // The AUSNUT record exists but does not carry this nutrient, so there
        // is nothing to match against — same category as an unmapped label.
        unmatchedLabels.push(entry.label)
        nutrientsValid = false
        break
      }
      calculated[targetField] = perHundredGrams * entry.conversion.grams / 100
    }

    if (!nutrientsValid) continue

    for (const field of Object.values(NUTRIENT_FIELDS)) {
      total[field] += calculated[field]
    }

    ingredientResults.push({
      ingredientLabel: entry.label,
      ausnutPublicFoodKey: entry.ausnutPublicFoodKey,
      grams: roundNutrient(entry.conversion.grams),
      conversionMethod: entry.conversion.method,
      estimated: entry.conversion.estimated,
      fallbackUsed: entry.conversion.fallbackUsed,
    })
  }

  const uniqueUnmatched = [...new Set(unmatchedLabels)]
  const uniqueUnestimated = [...new Set(unestimated)].filter(label => !uniqueUnmatched.includes(label))
  const uniqueUnresolved = [...uniqueUnmatched, ...uniqueUnestimated]
  const failures = { unmatched: uniqueUnmatched, unestimated: uniqueUnestimated }

  if (!allowPartial && uniqueUnresolved.length > 0) {
    return unavailable(
      'Nutrition could not be completed because one or more ingredient portions or AUSNUT mappings are unresolved.',
      failures,
    )
  }

  if (ingredientResults.length === 0) {
    return unavailable(
      uniqueUnresolved.length > 0
        ? 'No ingredient in this recipe could be costed against AUSNUT reference data.'
        : 'The recipe has no ingredients available for nutrition calculation.',
      failures,
    )
  }

  const roundedTotal = Object.fromEntries(
    Object.entries(total).map(([field, value]) => [field, roundNutrient(value)]),
  )
  const perServing = Object.fromEntries(
    Object.entries(total).map(([field, value]) => [field, roundNutrient(value / servings)]),
  )

  return {
    available: true,
    estimated: true,
    partial: uniqueUnresolved.length > 0,
    unresolvedIngredients: uniqueUnresolved,
    unmatchedIngredients: uniqueUnmatched,
    unestimatedIngredients: uniqueUnestimated,
    servings,
    total: roundedTotal,
    perServing,
    ingredients: ingredientResults,
    fallbackUsed: ingredientResults.some(item => item.fallbackUsed),
    source: NUTRITION_SOURCE,
  }
}

/**
 * Label (and alias) lookup into `ingredient-nutrition-v1.json`, so a recipe can
 * be costed from ingredient names alone when no recipe id exists.
 */
export function createIngredientNutritionLookup(ingredientNutrition = {}) {
  const items = Array.isArray(ingredientNutrition?.items) ? ingredientNutrition.items : []
  const lookup = new Map()

  items.forEach(item => {
    const label = normaliseIngredientLabel(item?.label)
    if (label) lookup.set(label, item)
  })

  items.forEach(item => {
    const aliases = [
      ...(Array.isArray(item?.aliases) ? item.aliases : []),
      ...(Array.isArray(item?.ocr_keywords) ? item.ocr_keywords : []),
    ]
    aliases.forEach(alias => {
      const key = normaliseIngredientLabel(alias)
      if (key && !lookup.has(key)) lookup.set(key, item)
    })
  })

  return lookup
}

/**
 * Nutrition for a recipe the dataset does not know — an AI-generated one —
 * from its ingredient names plus the standard v1 portion weights. Ingredients
 * may carry a quantity and unit; those that do not are costed at one standard
 * portion.
 */
export function calculateIngredientListNutrition({
  ingredients,
  servings,
  ingredientNutrition,
  ingredientPortions,
}) {
  const nutritionLookup = createIngredientNutritionLookup(ingredientNutrition)
  if (nutritionLookup.size === 0) {
    return unavailable('AUSNUT ingredient nutrition data is unavailable.')
  }

  const servingCount = positiveNumber(servings)
  if (servingCount === null) return unavailable('Recipe serving count is invalid.')

  const list = Array.isArray(ingredients) ? ingredients : []
  const resolved = []
  const unmatched = []
  const unestimated = []

  for (const ingredient of list) {
    const isObject = ingredient !== null && typeof ingredient === 'object'
    const rawLabel = isObject
      ? (ingredient.ingredient_label ?? ingredient.label)
      : ingredient
    const canonicalLabel = normaliseIngredientLabel(rawLabel)
    const item = nutritionLookup.get(canonicalLabel)

    if (!item?.nutrition) {
      unmatched.push(canonicalLabel || 'unknown')
      continue
    }

    const itemLabel = normaliseIngredientLabel(item.label)
    // The app stamps every confirmed ingredient with unit 'piece', which more
    // than half the portion table has no conversion for — there is no such
    // thing as one piece of olive oil. Rather than call that a missing AUSNUT
    // match, drop the unit and fall back to the ingredient's standard portion.
    const conversion = convertQuantityToGrams(
      { ...(isObject ? ingredient : {}), ingredient_label: itemLabel },
      ingredientPortions,
    ) ?? convertQuantityToGrams({ ingredient_label: itemLabel }, ingredientPortions)

    if (!conversion) {
      unestimated.push(itemLabel || canonicalLabel || 'unknown')
      continue
    }

    resolved.push({
      label: itemLabel,
      ausnutPublicFoodKey: item.ausnut_public_food_key,
      nutrition: item.nutrition,
      conversion,
    })
  }

  return summariseNutrition({
    resolved,
    unmatched,
    unestimated,
    servings: servingCount,
    allowPartial: true,
  })
}

export function calculateRecipeNutrition({
  recipeId,
  ingredientNutrition,
  recipeIngredientMap,
  ingredientPortions,
  recipePortions,
}) {
  const portionRecipe = recipePortions?.recipes?.[recipeId]
  const mappings = recipeIngredientMap?.recipes?.[recipeId]
  const nutritionItems = ingredientNutrition?.items

  if (!portionRecipe || !Array.isArray(portionRecipe.ingredients)) {
    return unavailable('No standard recipe portion data is available.')
  }
  if (!Array.isArray(mappings) || !Array.isArray(nutritionItems)) {
    return unavailable('AUSNUT ingredient mapping or nutrition data is unavailable.')
  }

  const servings = positiveNumber(portionRecipe.servings)
  if (servings === null) return unavailable('Recipe serving count is invalid.')

  const mappingByLabel = new Map(mappings.map(item => [item.ingredient_label, item]))
  const nutritionByKey = new Map(nutritionItems.map(item => [item.ausnut_public_food_key, item]))
  const unmatched = []
  const unestimated = []
  const resolved = []

  for (const ingredient of portionRecipe.ingredients) {
    const label = String(ingredient?.ingredient_label ?? '').trim()
    const mapping = mappingByLabel.get(label)
    const nutritionItem = nutritionByKey.get(mapping?.ausnut_public_food_key)

    if (!label || !mapping || !nutritionItem?.nutrition) {
      unmatched.push(label || 'unknown')
      continue
    }

    // Curated recipe portions carry their own units, so no unit fallback here:
    // a conversion that fails is a data bug worth surfacing, not a guess.
    const conversion = convertQuantityToGrams(ingredient, ingredientPortions)
    if (!conversion) {
      unestimated.push(label)
      continue
    }

    resolved.push({
      label,
      ausnutPublicFoodKey: mapping.ausnut_public_food_key,
      nutrition: nutritionItem.nutrition,
      conversion,
    })
  }

  return summariseNutrition({ resolved, unmatched, unestimated, servings })
}
