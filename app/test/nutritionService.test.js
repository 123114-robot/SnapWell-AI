import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateRecipeNutrition,
  convertQuantityToGrams,
} from '../src/recommendation/nutritionService.js'
import recommendationEngine from '../src/recommendation/recommendationEngine.js'
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
