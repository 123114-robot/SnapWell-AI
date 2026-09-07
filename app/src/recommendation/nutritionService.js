const NUTRIENT_FIELDS = Object.freeze({
  energy_kcal: 'kcal',
  protein_g: 'protein',
  carbs_g: 'carbs',
  fat_g: 'fat',
  fibre_g: 'fibre',
  sodium_mg: 'sodium',
})

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
  const quantity = suppliedQuantity ?? (portion ? 1 : null)
  const unit = normaliseUnit(ingredient?.unit ?? portion?.default_unit)

  if (quantity === null) return null
  if (unit === 'g') {
    return { grams: quantity, method: 'grams', estimated: false, fallbackUsed: false }
  }
  if (unit === 'kg') {
    return { grams: quantity * 1000, method: 'kilograms', estimated: false, fallbackUsed: false }
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

function unavailable(reason, unresolvedIngredients = []) {
  return {
    available: false,
    estimated: true,
    reason,
    unresolvedIngredients,
  }
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
  const unresolvedIngredients = []
  const ingredientResults = []
  const total = emptyNutrients()

  for (const ingredient of portionRecipe.ingredients) {
    const label = String(ingredient?.ingredient_label ?? '').trim()
    const mapping = mappingByLabel.get(label)
    const nutritionItem = nutritionByKey.get(mapping?.ausnut_public_food_key)
    const conversion = convertQuantityToGrams(ingredient, ingredientPortions)

    if (!label || !mapping || !nutritionItem?.nutrition || !conversion) {
      unresolvedIngredients.push(label || 'unknown')
      continue
    }

    const calculated = emptyNutrients()
    let nutrientsValid = true
    for (const [sourceField, targetField] of Object.entries(NUTRIENT_FIELDS)) {
      const perHundredGrams = Number(nutritionItem.nutrition[sourceField])
      if (!Number.isFinite(perHundredGrams)) {
        unresolvedIngredients.push(label)
        nutrientsValid = false
        break
      }
      calculated[targetField] = perHundredGrams * conversion.grams / 100
    }

    if (!nutrientsValid) continue

    for (const field of Object.values(NUTRIENT_FIELDS)) {
      total[field] += calculated[field]
    }

    ingredientResults.push({
      ingredientLabel: label,
      ausnutPublicFoodKey: mapping.ausnut_public_food_key,
      grams: roundNutrient(conversion.grams),
      conversionMethod: conversion.method,
      estimated: conversion.estimated,
      fallbackUsed: conversion.fallbackUsed,
    })
  }

  if (unresolvedIngredients.length > 0) {
    return unavailable(
      'Nutrition could not be completed because one or more ingredient portions or AUSNUT mappings are unresolved.',
      [...new Set(unresolvedIngredients)],
    )
  }

  if (ingredientResults.length === 0) {
    return unavailable('The recipe has no ingredients available for nutrition calculation.')
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
    servings,
    total: roundedTotal,
    perServing,
    ingredients: ingredientResults,
    fallbackUsed: ingredientResults.some(item => item.fallbackUsed),
    source: 'AUSNUT 2023 per-100g data with standard v1 portion estimates',
  }
}
