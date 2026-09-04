import assert from 'node:assert/strict'
import test from 'node:test'

import recommendationEngine from '../src/recommendation/recommendationEngine.js'
import { matchRecipes } from '../src/recommendation/recipeMatcher.js'
import { generateOnlineRecommendations, buildAiInputPayload } from '../src/recommendation/geminiService.js'

const EMPTY_NUTRITION_DATA = Object.freeze({ items: [] })

function recipe({
  id,
  ingredients,
  tags = [],
  cuisine = 'Australian everyday',
  mealType = 'dinner',
}) {
  return {
    recipe_id: id,
    recipe_name: `Recipe ${id}`,
    meal_type: mealType,
    cuisine_style: cuisine,
    ingredients,
    steps: ['Prepare ingredients', 'Cook and serve'],
    dietary_tags: tags,
  }
}

function ingredient(label, source = 'manual') {
  return { label, quantity: 1, unit: 'piece', source }
}

function match(recipes, ingredients = [], preferences = {}) {
  return matchRecipes({
    recipes,
    ingredients,
    preferences,
    ingredientNutrition: EMPTY_NUTRITION_DATA,
  })
}

function runEngine(recipes, ingredients = [], preferences = {}, options = {}) {
  return recommendationEngine(
    { ingredients, preferences },
    { recipes, ingredientNutrition: EMPTY_NUTRITION_DATA },
    options,
  )
}

test('3 matched ingredients out of 4 returns 75% coverage', () => {
  const results = match(
    [recipe({ id: 'R001', ingredients: ['apple', 'egg', 'milk', 'bread'] })],
    [ingredient('apple'), ingredient('egg'), ingredient('milk')],
  )

  assert.equal(results.length, 1)
  assert.equal(results[0].coverageScore, 75)
  assert.deepEqual(results[0].matchedIngredients, ['apple', 'egg', 'milk'])
  assert.deepEqual(results[0].missingIngredients, ['bread'])
})

test('75% top result returns local mode and universal recipe structure', async () => {
  const result = await runEngine(
    [recipe({ id: 'R001', ingredients: ['apple', 'egg', 'milk', 'bread'] })],
    [ingredient('apple'), ingredient('egg'), ingredient('milk')],
  )

  assert.equal(result.topCoverageScore, 75)
  assert.equal(result.fallbackRequired, false)
  assert.equal(result.mode, 'local')
  assert.equal(result.source, 'local')
  assert.equal(result.recommendations.length, 1)

  const rec = result.recommendations[0]
  assert.equal(rec.id, 'R001')
  assert.equal(rec.source, 'local')
  assert.equal(rec.displayCoverageScore, 75)
  assert.deepEqual(rec.matchedIngredients, ['apple', 'egg', 'milk'])
  assert.deepEqual(rec.missingIngredients, ['bread'])
  assert.equal(Array.isArray(rec.missingIngredientDetails), true)
  assert.equal(rec.missingIngredientDetails[0].label, 'bread')
  assert.equal(rec.missingIngredientDetails[0].shoppingLinks.length >= 2, true)
})

test('60% top result triggers online recommendation when available', async () => {
  const mockOnlineGenerator = async ({ inputPayload }) => {
    assert.equal(inputPayload.input.confirmed_ingredients.length, 3)
    return {
      success: true,
      data: {
        recommendations: [
          {
            recipe_id: 'AI001',
            recipe_name: 'Apple Egg Milk Toast',
            meal_type: 'breakfast',
            cuisine_style: 'Australian cafe',
            used_ingredients: ['apple', 'egg', 'milk'],
            missing_ingredients: [
              {
                label: 'cinnamon',
                display_name: 'Cinnamon',
                optional: true,
                reason: 'Adds sweet aromatic flavour',
                shopping_links: {
                  coles: 'https://www.coles.com.au/search/products?q=cinnamon',
                  woolworths: 'https://www.woolworths.com.au/shop/search/products?searchTerm=cinnamon',
                },
              },
            ],
            steps: ['Whisk egg and milk', 'Slice apple and toast'],
            dietary_tags: ['vegetarian'],
            nutrition_note: 'Estimated from AUSNUT reference data.',
            recommendation_reason: 'Uses your available fresh ingredients.',
          },
        ],
        summary: { total_recommendations: 1, assumptions: [] },
      },
    }
  }

  const result = await runEngine(
    [recipe({ id: 'R001', ingredients: ['apple', 'egg', 'milk', 'bread', 'tomato'] })],
    [ingredient('apple'), ingredient('egg'), ingredient('milk')],
    {},
    { generateOnlineRecommendations: mockOnlineGenerator },
  )

  assert.equal(result.topCoverageScore, 60)
  assert.equal(result.fallbackRequired, true)
  assert.equal(result.mode, 'online')
  assert.equal(result.source, 'online')
  assert.equal(result.recommendations.length, 1)

  const rec = result.recommendations[0]
  assert.equal(rec.id, 'AI001')
  assert.equal(rec.source, 'online')
  assert.equal(rec.name, 'Apple Egg Milk Toast')
  assert.equal(rec.coverageScore, 75) // 3 used out of 4 total
  assert.deepEqual(rec.matchedIngredients, ['apple', 'egg', 'milk'])
  assert.deepEqual(rec.missingIngredients, ['cinnamon'])
  assert.equal(rec.missingIngredientDetails[0].shoppingLinks.length, 2)
  assert.equal(result.diagnostics.onlineRecommendationStatus, 'success')
})

test('Online recommendation gracefully falls back to local recipe when service fails', async () => {
  const mockFailingOnlineGenerator = async () => ({
    success: false,
    error: 'Unable to connect to online service.',
  })

  const result = await runEngine(
    [recipe({ id: 'R001', ingredients: ['apple', 'egg', 'milk', 'bread', 'tomato'] })],
    [ingredient('apple'), ingredient('egg'), ingredient('milk')],
    {},
    { generateOnlineRecommendations: mockFailingOnlineGenerator },
  )

  assert.equal(result.fallbackRequired, true)
  assert.equal(result.mode, 'local')
  assert.equal(result.source, 'local')
  assert.equal(result.recommendations.length, 1)
  assert.equal(result.recommendations[0].id, 'R001')
  assert.equal(result.diagnostics.onlineRecommendationStatus, 'failed')
  assert.equal(result.diagnostics.onlineRecommendationNote, 'Unable to connect to online service.')
})

test('Online recommendation cleanly times out after default or custom duration', async () => {
  const mockSlowFetch = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 1000)
    if (typeof timer.unref === 'function') timer.unref()
  })

  const onlineResult = await generateOnlineRecommendations({
    inputPayload: { input: {} },
    apiKey: 'test-api-key',
    timeoutMs: 50,
    fetchFn: (url, options) => new Promise((resolve, reject) => {
      options?.signal?.addEventListener('abort', () => {
        const error = new Error('The operation was aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }),
  })

  assert.equal(onlineResult.success, false)
  assert.equal(onlineResult.error, 'Unable to connect to online service.')
})

test('buildAiInputPayload conforms to ai-input-schema-v1', () => {
  const payload = buildAiInputPayload({
    ingredients: [ingredient('apple', 'vision')],
    preferences: { diets: ['Vegetarian'], allergies: ['No nuts'], goals: ['Weight loss'] },
    ingredientNutrition: {
      items: [
        {
          label: 'apple',
          source: 'vision',
          ausnut_public_food_key: 'F000114',
          ausnut_food_name: 'Apple raw',
          nutrition: { energy_kcal: 52 },
        },
      ],
    },
  })

  assert.equal(payload.version, 'v1')
  assert.equal(payload.input.confirmed_ingredients.length, 1)
  assert.equal(payload.input.confirmed_ingredients[0].label, 'apple')
  assert.equal(payload.input.confirmed_ingredients[0].ausnut_public_food_key, 'F000114')
  assert.equal(payload.input.user_preferences.dietary_pattern, 'Vegetarian')
  assert.deepEqual(payload.input.user_preferences.allergens, ['No nuts'])
  assert.equal(payload.input.user_preferences.health_goal, 'Weight loss')
})

test('Vegetarian excludes meat recipes', () => {
  const recipes = [
    recipe({ id: 'MEAT', ingredients: ['chicken_breast', 'rice'] }),
    recipe({ id: 'VEGETARIAN', ingredients: ['egg', 'milk', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { diets: ['Vegetarian'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['VEGETARIAN'])
})

test('Vegan excludes meat, seafood, egg and dairy recipes', () => {
  const recipes = [
    recipe({ id: 'MEAT', ingredients: ['chicken_breast', 'rice'] }),
    recipe({ id: 'SEAFOOD', ingredients: ['prawn', 'rice'] }),
    recipe({ id: 'EGG', ingredients: ['egg', 'rice'] }),
    recipe({ id: 'DAIRY', ingredients: ['milk', 'rice'] }),
    recipe({ id: 'PLANT', ingredients: ['tofu', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { diets: ['Vegan'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['PLANT'])
})

test('No nuts excludes peanut_butter recipes', () => {
  const recipes = [
    recipe({ id: 'NUT', ingredients: ['peanut_butter', 'bread'] }),
    recipe({ id: 'SAFE', ingredients: ['apple', 'bread'] }),
  ]

  const results = match(recipes, [ingredient('bread')], { allergies: ['No nuts'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['SAFE'])
})

test('No soy excludes tofu and soy_sauce recipes', () => {
  const recipes = [
    recipe({ id: 'TOFU', ingredients: ['tofu', 'rice'] }),
    recipe({ id: 'SAUCE', ingredients: ['soy_sauce', 'rice'] }),
    recipe({ id: 'SAFE', ingredients: ['tomato', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { allergies: ['No soy'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['SAFE'])
})

test('Duplicate ingredient inputs do not increase coverage', () => {
  const results = match(
    [recipe({ id: 'R001', ingredients: ['apple', 'banana'] })],
    [ingredient('apple'), ingredient('apple'), ingredient(' apple ')],
  )

  assert.equal(results[0].coverageScore, 50)
  assert.deepEqual(results[0].matchedIngredients, ['apple'])
})

test('Unknown manual ingredients do not crash matching', () => {
  assert.doesNotThrow(() => {
    const results = match(
      [recipe({ id: 'R001', ingredients: ['apple', 'banana'] })],
      [ingredient('dragon fruit powder')],
    )

    assert.equal(results[0].coverageScore, 0)
    assert.deepEqual(results[0].matchedIngredients, [])
    assert.deepEqual(results[0].missingIngredients, ['apple', 'banana'])
  })
})

test('Recipe with zero ingredients is skipped without division by zero', async () => {
  const zeroIngredientRecipe = recipe({ id: 'EMPTY', ingredients: [] })
  const matchingResults = match([zeroIngredientRecipe], [ingredient('apple')])
  const engineResult = await runEngine([zeroIngredientRecipe], [ingredient('apple')])

  assert.deepEqual(matchingResults, [])
  assert.equal(engineResult.topCoverageScore, 0)
  assert.equal(engineResult.fallbackRequired, true)
  assert.equal(Number.isFinite(engineResult.topCoverageScore), true)
})

test('Health and cuisine preferences do not change coverageScore', () => {
  const targetRecipe = recipe({
    id: 'R001',
    ingredients: ['apple', 'banana', 'milk', 'oats'],
    tags: ['low-calorie'],
    cuisine: 'Australian cafe',
  })
  const available = [ingredient('apple'), ingredient('banana')]
  const withoutPreferences = match([targetRecipe], available)
  const withPreferences = match([targetRecipe], available, {
    goals: ['Weight loss'],
    cuisinePreference: 'Australian cafe',
  })

  assert.equal(withoutPreferences[0].coverageScore, 50)
  assert.equal(withPreferences[0].coverageScore, 50)
  assert.deepEqual(withPreferences[0].preferenceFit, {
    healthGoalMatch: true,
    cuisineMatch: true,
  })
})

test('Empty ingredient input is handled safely', async () => {
  const result = await runEngine(
    [recipe({ id: 'R001', ingredients: ['apple', 'banana'] })],
    [],
  )

  assert.equal(result.topCoverageScore, 0)
  assert.equal(result.fallbackRequired, true)
  assert.equal(result.mode, 'local')
  assert.equal(result.diagnostics.confirmedIngredientCount, 0)
  assert.equal(result.recommendations[0].coverageScore, 0)
})

test('Gluten-Free excludes bread, flour, noodles, pasta, tortilla and soy_sauce recipes', () => {
  const recipes = [
    recipe({ id: 'BREAD', ingredients: ['bread', 'rice'] }),
    recipe({ id: 'FLOUR', ingredients: ['flour', 'rice'] }),
    recipe({ id: 'NOODLES', ingredients: ['noodles', 'rice'] }),
    recipe({ id: 'PASTA', ingredients: ['pasta', 'rice'] }),
    recipe({ id: 'TORTILLA', ingredients: ['tortilla', 'rice'] }),
    recipe({ id: 'SOY_SAUCE', ingredients: ['soy_sauce', 'rice'] }),
    recipe({ id: 'SAFE', ingredients: ['tomato', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { diets: ['Gluten-free'] })
  const eligibleIds = results.map(result => result.recipe.recipe_id)

  assert.deepEqual(eligibleIds, ['SAFE'])
  assert.equal(eligibleIds.includes('SOY_SAUCE'), false)
})

test('Dairy-Free excludes milk, cheese, yoghurt and butter recipes', () => {
  const recipes = [
    recipe({ id: 'MILK', ingredients: ['milk', 'rice'] }),
    recipe({ id: 'CHEESE', ingredients: ['cheese', 'rice'] }),
    recipe({ id: 'YOGHURT', ingredients: ['yoghurt', 'rice'] }),
    recipe({ id: 'BUTTER', ingredients: ['butter', 'rice'] }),
    recipe({ id: 'SAFE', ingredients: ['tomato', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { diets: ['Dairy-free'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['SAFE'])
})

test('No shellfish excludes prawn recipes', () => {
  const recipes = [
    recipe({ id: 'PRAWN', ingredients: ['prawn', 'rice'] }),
    recipe({ id: 'SAFE', ingredients: ['salmon', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { allergies: ['No shellfish'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['SAFE'])
})

test('No eggs excludes egg recipes', () => {
  const recipes = [
    recipe({ id: 'EGG', ingredients: ['egg', 'rice'] }),
    recipe({ id: 'SAFE', ingredients: ['tomato', 'rice'] }),
  ]

  const results = match(recipes, [ingredient('rice')], { allergies: ['No eggs'] })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['SAFE'])
})

test('Breakfast meal type keeps breakfast recipes and excludes dinner recipes', () => {
  const recipes = [
    recipe({ id: 'BREAKFAST', ingredients: ['egg', 'bread'], mealType: 'breakfast' }),
    recipe({ id: 'DINNER', ingredients: ['egg', 'bread'], mealType: 'dinner' }),
  ]

  const results = match(recipes, [ingredient('egg')], { mealType: 'Breakfast' })

  assert.deepEqual(results.map(result => result.recipe.recipe_id), ['BREAKFAST'])
})
