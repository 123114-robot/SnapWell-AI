import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateIngredientListNutrition,
  calculateRecipeNutrition,
  convertQuantityToGrams,
} from '../src/recommendation/nutritionService.js'
import recommendationEngine, { AI_DEFAULT_SERVINGS } from '../src/recommendation/recommendationEngine.js'
import { adaptRecommendationResult } from '../src/recommendation/recommendationAdapter.js'

const ingredientPortions = {
  portions: {
    egg: {
      default_unit: 'piece',
      grams_per_unit: 50,
      unit_grams: { piece: 50 },
    },
    bread: {
      default_unit: 'slice',
      grams_per_unit: 34,
      unit_grams: { slice: 34 },
    },
  },
}

const ingredientNutrition = {
  items: [
    {
      label: 'carrot',
      ausnut_public_food_key: 'F-CARROT',
      nutrition: {
        energy_kcal: 40,
        protein_g: 1,
        carbs_g: 10,
        fat_g: 0,
        fibre_g: 3,
        sodium_mg: 20,
      },
    },
    {
      label: 'egg',
      ausnut_public_food_key: 'F-EGG',
      nutrition: {
        energy_kcal: 143,
        protein_g: 13,
        carbs_g: 1,
        fat_g: 10,
        fibre_g: 0,
        sodium_mg: 140,
      },
    },
    {
      label: 'bread',
      ausnut_public_food_key: 'F-BREAD',
      nutrition: {
        energy_kcal: 250,
        protein_g: 8,
        carbs_g: 50,
        fat_g: 3,
        fibre_g: 2,
        sodium_mg: 400,
      },
    },
    {
      label: 'mystery',
      ausnut_public_food_key: 'F-MYSTERY',
      nutrition: {
        energy_kcal: 100,
        protein_g: 1,
        carbs_g: 1,
        fat_g: 1,
        fibre_g: 1,
        sodium_mg: 1,
      },
    },
  ],
}

const recipeIngredientMap = {
  recipes: {
    DIRECT: [{ ingredient_label: 'carrot', ausnut_public_food_key: 'F-CARROT' }],
    EGGS: [{ ingredient_label: 'egg', ausnut_public_food_key: 'F-EGG' }],
    BREAD: [{ ingredient_label: 'bread', ausnut_public_food_key: 'F-BREAD' }],
    MULTI: [
      { ingredient_label: 'carrot', ausnut_public_food_key: 'F-CARROT' },
      { ingredient_label: 'egg', ausnut_public_food_key: 'F-EGG' },
    ],
    MISSING: [{ ingredient_label: 'mystery', ausnut_public_food_key: 'F-MYSTERY' }],
  },
}

function calculate(recipeId, recipe) {
  return calculateRecipeNutrition({
    recipeId,
    ingredientNutrition,
    recipeIngredientMap,
    ingredientPortions,
    recipePortions: { recipes: { [recipeId]: recipe } },
  })
}

test('Direct gram quantities use the supplied grams', () => {
  const result = calculate('DIRECT', {
    servings: 1,
    ingredients: [{
      ingredient_label: 'carrot',
      quantity_g: 50,
      quantity: 999,
      unit: 'handful',
    }],
  })

  assert.equal(result.available, true)
  assert.equal(result.ingredients[0].grams, 50)
  assert.equal(result.ingredients[0].conversionMethod, 'explicit-grams')
  assert.equal(result.total.kcal, 20)
})

test('Two eggs at 50 g per piece convert to 100 g', () => {
  const conversion = convertQuantityToGrams(
    { ingredient_label: 'egg', quantity: 2, unit: 'piece' },
    ingredientPortions,
  )
  const result = calculate('EGGS', {
    servings: 1,
    ingredients: [{ ingredient_label: 'egg', quantity: 2, unit: 'piece' }],
  })

  assert.equal(conversion.grams, 100)
  assert.equal(result.total.kcal, 143)
})

test('Two bread slices at 34 g per slice convert to 68 g', () => {
  const conversion = convertQuantityToGrams(
    { ingredient_label: 'bread', quantity: 2, unit: 'slice' },
    ingredientPortions,
  )
  const result = calculate('BREAD', {
    servings: 1,
    ingredients: [{ ingredient_label: 'bread', quantity: 2, unit: 'slice' }],
  })

  assert.equal(conversion.grams, 68)
  assert.equal(result.total.kcal, 170)
})

test('Multi-ingredient nutrition is summed from AUSNUT per-100g values', () => {
  const result = calculate('MULTI', {
    servings: 1,
    ingredients: [
      { ingredient_label: 'carrot', quantity: 50, unit: 'g' },
      { ingredient_label: 'egg', quantity: 2, unit: 'piece' },
    ],
  })

  assert.deepEqual(result.total, {
    kcal: 163,
    protein: 13.5,
    carbs: 6,
    fat: 10,
    fibre: 1.5,
    sodium: 150,
  })
})

test('Recipe totals are divided by the serving count', () => {
  const result = calculate('EGGS', {
    servings: 2,
    ingredients: [{ ingredient_label: 'egg', quantity: 2, unit: 'piece' }],
  })

  assert.equal(result.total.kcal, 143)
  assert.equal(result.perServing.kcal, 71.5)
  assert.equal(result.perServing.protein, 6.5)
})

test('Missing portion conversion returns unavailable without crashing', () => {
  assert.doesNotThrow(() => {
    const result = calculate('MISSING', {
      servings: 1,
      ingredients: [{ ingredient_label: 'mystery', quantity: 1, unit: 'handful' }],
    })

    assert.equal(result.available, false)
    assert.deepEqual(result.unresolvedIngredients, ['mystery'])
  })
})

test('Recommendation adapter preserves calculated nutrition without changing coverage', async () => {
  const engineResult = await recommendationEngine(
    { ingredients: [{ label: 'carrot' }], preferences: {} },
    {
      recipes: [{
        recipe_id: 'DIRECT',
        recipe_name: 'Carrot recipe',
        meal_type: 'side',
        cuisine_style: 'Australian everyday',
        ingredients: ['carrot'],
        steps: [],
        dietary_tags: [],
      }],
      ingredientNutrition,
      recipeIngredientMap,
      ingredientPortions,
      recipePortions: {
        recipes: {
          DIRECT: {
            servings: 1,
            ingredients: [{ ingredient_label: 'carrot', quantity: 50, unit: 'g' }],
          },
        },
      },
    },
  )
  const adapted = adaptRecommendationResult(engineResult)

  assert.equal(adapted.recommendations[0].coverageScore, 100)
  assert.equal(adapted.recommendations[0].nutrition.available, true)
  assert.equal(adapted.recommendations[0].nutrition.perServing.kcal, 20)
})

function calculateList(ingredients, servings) {
  return calculateIngredientListNutrition({
    ingredients,
    servings,
    ingredientNutrition,
    ingredientPortions,
  })
}

test('An unquantified ingredient is costed at one standard portion', () => {
  const result = calculateList(['egg'], 1)

  assert.equal(result.available, true)
  assert.equal(result.ingredients[0].grams, 50)
  assert.equal(result.ingredients[0].conversionMethod, 'default-standard-portion')
  assert.equal(result.ingredients[0].fallbackUsed, true)
  assert.equal(result.total.kcal, 71.5)
})

test('A gram-based ingredient falls back to its default_quantity, not one gram', () => {
  const conversion = convertQuantityToGrams(
    { ingredient_label: 'beef_mince' },
    { portions: { beef_mince: { default_unit: 'g', default_quantity: 300, grams_per_unit: 1, unit_grams: { g: 1 } } } },
  )

  assert.equal(conversion.grams, 300)
  assert.equal(conversion.fallbackUsed, true)
})

test('An ingredient list keeps supplied quantities and divides by servings', () => {
  const result = calculateList(
    [{ label: 'egg', quantity: 2, unit: 'piece' }, { label: 'bread', quantity: 2, unit: 'slice' }],
    2,
  )

  assert.equal(result.available, true)
  assert.equal(result.total.kcal, 313)
  assert.equal(result.perServing.kcal, 156.5)
})

test('An ingredient outside the AUSNUT map is excluded and named, not silently dropped', () => {
  const result = calculateList([{ label: 'egg', quantity: 2, unit: 'piece' }, 'quinoa'], 1)

  assert.equal(result.available, true)
  assert.equal(result.partial, true)
  assert.deepEqual(result.unmatchedIngredients, ['quinoa'])
  assert.deepEqual(result.unestimatedIngredients, [])
  assert.equal(result.total.kcal, 143)
})

test('A unit the portion table cannot convert falls back to the standard portion', () => {
  // The app stamps every confirmed ingredient with unit 'piece', and bread is
  // measured in slices — that must not read as a missing AUSNUT match.
  const result = calculateList([{ label: 'bread', quantity: 1, unit: 'piece' }], 1)

  assert.equal(result.available, true)
  assert.equal(result.partial, false)
  assert.equal(result.ingredients[0].grams, 34)
  assert.equal(result.ingredients[0].conversionMethod, 'default-standard-portion')
})

test('An AUSNUT match with no portion data is reported apart from an unmatched one', () => {
  // carrot is in the nutrition table but not the portion table, so its grams
  // cannot be estimated even after the unit fallback.
  const result = calculateList([{ label: 'egg', quantity: 2, unit: 'piece' }, 'carrot', 'quinoa'], 1)

  assert.equal(result.available, true)
  assert.equal(result.partial, true)
  assert.deepEqual(result.unmatchedIngredients, ['quinoa'])
  assert.deepEqual(result.unestimatedIngredients, ['carrot'])
  assert.deepEqual(result.unresolvedIngredients, ['quinoa', 'carrot'])
  assert.equal(result.total.kcal, 143)
})

test('An ingredient list that maps to nothing stays unavailable', () => {
  const result = calculateList(['quinoa', 'tahini'], 2)

  assert.equal(result.available, false)
  assert.deepEqual(result.unresolvedIngredients, ['quinoa', 'tahini'])
  assert.deepEqual(result.unmatchedIngredients, ['quinoa', 'tahini'])
})

const onlineData = {
  recipes: [{
    recipe_id: 'DIRECT',
    recipe_name: 'Carrot recipe',
    meal_type: 'side',
    cuisine_style: 'Australian everyday',
    ingredients: ['carrot', 'egg', 'bread', 'mystery'],
    steps: [],
    dietary_tags: [],
  }],
  ingredientNutrition,
  recipeIngredientMap,
  ingredientPortions,
  recipePortions: {
    recipes: {
      DIRECT: {
        servings: 1,
        ingredients: [{ ingredient_label: 'carrot', quantity: 50, unit: 'g' }],
      },
    },
  },
}

function runOnline(recipe) {
  return recommendationEngine(
    { ingredients: [{ label: 'egg', quantity: 2, unit: 'piece' }], preferences: {} },
    onlineData,
    {
      generateOnlineRecommendations: async () => ({
        success: true,
        data: { recommendations: [recipe], summary: { assumptions: [] } },
      }),
    },
  )
}

test('An AI recipe is costed from AUSNUT instead of reporting no nutrition', async () => {
  const result = await runOnline({
    recipe_id: 'AI001',
    recipe_name: 'Egg on toast',
    servings: 2,
    used_ingredients: ['egg'],
    missing_ingredients: [
      { label: 'bread', display_name: 'Bread', optional: false },
      { label: 'carrot', display_name: 'Carrot', optional: true },
    ],
    steps: ['Toast the bread.'],
    nutrition_note: 'Nutrition values should be calculated by the app from AUSNUT data.',
  })
  const nutrition = result.recommendations[0].nutrition

  assert.equal(result.mode, 'online')
  assert.equal(nutrition.available, true)
  assert.equal(nutrition.servings, 2)
  assert.equal(nutrition.servingsAssumed, false)
  // Two confirmed eggs at 50 g, one standard bread slice at 34 g. The optional
  // carrot is not counted.
  assert.deepEqual(
    nutrition.ingredients.map(item => [item.ingredientLabel, item.grams]),
    [['egg', 100], ['bread', 34]],
  )
  assert.equal(nutrition.perServing.kcal, 114.0)
})

test('An AI recipe without a serving count is divided by the assumed default', async () => {
  const result = await runOnline({
    recipe_id: 'AI002',
    recipe_name: 'Scrambled eggs',
    used_ingredients: ['egg'],
    missing_ingredients: [],
    steps: ['Scramble.'],
  })
  const nutrition = result.recommendations[0].nutrition

  assert.equal(nutrition.available, true)
  assert.equal(nutrition.servings, AI_DEFAULT_SERVINGS)
  assert.equal(nutrition.servingsAssumed, true)
  assert.equal(nutrition.perServing.kcal, 71.5)
})

test('An AI recipe is costed from the grams the recipe itself gives', async () => {
  const result = await runOnline({
    recipe_id: 'AI003',
    recipe_name: 'Egg on toast',
    servings: 2,
    used_ingredients: ['egg'],
    missing_ingredients: [{ label: 'bread', display_name: 'Bread', optional: false }],
    ingredient_quantities: [{ label: 'egg', grams: 120 }, { label: 'bread', grams: 68 }],
    steps: ['Toast the bread.'],
  })
  const nutrition = result.recommendations[0].nutrition

  assert.equal(nutrition.quantitiesFromRecipe, true)
  // The recipe's own 120 g of egg, not the two confirmed eggs (100 g)
  assert.deepEqual(
    nutrition.ingredients.map(item => [item.ingredientLabel, item.grams]),
    [['egg', 120], ['bread', 68]],
  )
  // (143 kcal x 1.2 + 250 kcal x 0.68) / 2 servings
  assert.equal(nutrition.perServing.kcal, 170.8)
})

test('An ingredient the recipe gave no weight for is estimated, and the result says so', async () => {
  const result = await runOnline({
    recipe_id: 'AI004',
    recipe_name: 'Egg on toast',
    servings: 2,
    used_ingredients: ['egg'],
    missing_ingredients: [{ label: 'bread', display_name: 'Bread', optional: false }],
    ingredient_quantities: [{ label: 'egg', grams: 120 }],
    steps: ['Toast the bread.'],
  })
  const nutrition = result.recommendations[0].nutrition

  assert.equal(nutrition.quantitiesFromRecipe, false)
  assert.deepEqual(
    nutrition.ingredients.map(item => [item.ingredientLabel, item.grams]),
    [['egg', 120], ['bread', 34]],
  )
})

test('An implausible weight from the AI is ignored rather than trusted', async () => {
  const result = await runOnline({
    recipe_id: 'AI005',
    recipe_name: 'Scrambled eggs',
    servings: 2,
    used_ingredients: ['egg'],
    missing_ingredients: [],
    ingredient_quantities: [{ label: 'egg', grams: -5 }, { label: 'egg', grams: 99999 }],
    steps: ['Scramble.'],
  })
  const nutrition = result.recommendations[0].nutrition

  assert.equal(nutrition.quantitiesFromRecipe, false)
  assert.deepEqual(nutrition.ingredients.map(item => [item.ingredientLabel, item.grams]), [['egg', 100]])
})

test('A plural label from the AI still finds its AUSNUT entry', async () => {
  const result = await runOnline({
    recipe_id: 'AI006',
    recipe_name: 'Boiled eggs',
    servings: 1,
    used_ingredients: ['Eggs'],
    missing_ingredients: [],
    ingredient_quantities: [{ label: 'eggs', grams: 110 }],
    steps: ['Boil.'],
  })
  const nutrition = result.recommendations[0].nutrition

  assert.equal(nutrition.available, true)
  assert.equal(nutrition.quantitiesFromRecipe, true)
  assert.deepEqual(nutrition.ingredients.map(item => [item.ingredientLabel, item.grams]), [['egg', 110]])
})
