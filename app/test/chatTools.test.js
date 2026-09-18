import assert from 'node:assert/strict'
import test from 'node:test'

import { buildChatContext, candidateRecipeIds } from '../src/chat/chatContext.js'
import { CHAT_STAGES } from '../src/chat/chatStages.js'
import {
  MAX_FIND_RESULTS,
  TOOL_NAMES,
  createChatToolbox,
} from '../src/chat/chatTools.js'
import { BLOCK_REASONS, NUTRITION_PLACEHOLDER, verifyChatAnswer } from '../src/chat/chatGuard.js'

function recommendation({
  id,
  name = `Recipe ${id}`,
  mealType = 'dinner',
  ingredients = ['egg', 'bread'],
  missing = [],
  coverageScore = 80,
  source = 'local',
  nutrition = null,
} = {}) {
  return {
    id,
    name,
    source,
    mealType,
    cuisineStyle: 'Australian everyday',
    ingredients,
    steps: ['Cook it'],
    tags: [],
    coverageScore,
    displayCoverageScore: Math.round(coverageScore),
    matchedIngredients: ingredients.filter(item => !missing.includes(item)),
    missingIngredients: missing,
    nutrition: nutrition ?? {
      available: true,
      partial: false,
      source: 'AUSNUT 2023 test data',
      servings: 2,
      perServing: { kcal: 312.46, protein: 12.44, carbs: 30.06, fat: 15.21, fibre: 4.13, sodium: 380.4 },
    },
  }
}

function toolbox({ recipes = [recommendation({ id: 'R001' })], diets = [], allergies = [], ingredients = [] } = {}) {
  return createChatToolbox({
    recommendationResult: { recommendations: recipes },
    preferences: { diets, allergies },
    ingredients,
  })
}

async function call(box, name, args) {
  return { name, args, result: await box.run(name, args) }
}

function nineRecipes() {
  return Array.from({ length: 9 }, (unused, index) => recommendation({
    id: `R00${index + 1}`,
    ingredients: index === 7 ? ['tomato', 'rice'] : ['egg', 'bread'],
  }))
}

function contextFor(recipes, preferences = {}) {
  return buildChatContext({
    ingredients: [],
    preferences,
    recommendationResult: { recommendations: recipes },
  })
}

// A five-recipe book, small enough to work the numbers out by hand. With egg
// and bread on the list, B001 and B002 sit at 2 of 3 (67%), B005 at 1 of 2
// (50%), and B003 and B004 share nothing.
function bookRecipe(id, name, ingredients) {
  return {
    recipe_id: id,
    recipe_name: name,
    meal_type: 'breakfast',
    cuisine_style: 'Australian cafe',
    ingredients,
    steps: ['Cook it'],
    dietary_tags: [],
  }
}

function bookData() {
  return {
    recipes: [
      bookRecipe('B001', 'Egg toast', ['egg', 'bread', 'butter']),
      bookRecipe('B002', 'Tomato egg toast', ['egg', 'bread', 'tomato']),
      bookRecipe('B003', 'Tomato salad', ['tomato', 'onion', 'olive_oil']),
      bookRecipe('B004', 'Butter rice', ['butter', 'rice']),
      bookRecipe('B005', 'Prawn toast', ['prawn', 'bread']),
    ],
    ingredientNutrition: {
      items: [
        {
          label: 'egg',
          ausnut_public_food_key: 'F-EGG',
          nutrition: { energy_kcal: 143, protein_g: 13, carbs_g: 1, fat_g: 10, fibre_g: 0, sodium_mg: 140 },
        },
        {
          label: 'bread',
          ausnut_public_food_key: 'F-BREAD',
          nutrition: { energy_kcal: 250, protein_g: 8, carbs_g: 50, fat_g: 3, fibre_g: 2, sodium_mg: 400 },
        },
      ],
    },
    ingredientPortions: {
      portions: {
        egg: { default_unit: 'piece', grams_per_unit: 50, unit_grams: { piece: 50 } },
        bread: { default_unit: 'slice', grams_per_unit: 34, unit_grams: { slice: 34 } },
      },
    },
  }
}

function ingredientBox({ allergies = [], diets = [], list = null } = {}) {
  let loads = 0
  const box = createChatToolbox({
    stage: CHAT_STAGES.INGREDIENTS,
    preferences: { allergies, diets },
    ingredients: list ?? [
      { label: 'egg', quantity: 2, unit: 'piece' },
      { label: 'bread', quantity: 1, unit: 'piece' },
    ],
    loadData: async () => {
      loads += 1
      return bookData()
    },
  })
  return { box, loads: () => loads }
}

test('Each stage declares and runs only its own tools', async () => {
  const recipeTools = toolbox().declarations.map(declaration => declaration.name)
  const { box } = ingredientBox()
  const ingredientTools = box.declarations.map(declaration => declaration.name)

  assert.ok(recipeTools.includes(TOOL_NAMES.FIND_RECIPES))
  assert.equal(recipeTools.includes(TOOL_NAMES.SUGGEST_ADDITIONS), false)
  assert.ok(ingredientTools.includes(TOOL_NAMES.SUGGEST_ADDITIONS))
  assert.equal(ingredientTools.includes(TOOL_NAMES.FIND_RECIPES), false)

  for (const name of ingredientTools) {
    assert.notEqual((await box.run(name, {})).error, 'unknown_tool', name)
  }
  assert.equal((await box.run(TOOL_NAMES.FIND_RECIPES, {})).error, 'unknown_tool')
})

test('An unknown tool returns an error instead of throwing', async () => {
  assert.equal((await toolbox().run('delete_everything', {})).error, 'unknown_tool')
})

test('A tool whose data will not load reports a failure instead of throwing', async () => {
  const box = createChatToolbox({
    stage: CHAT_STAGES.INGREDIENTS,
    ingredients: [{ label: 'egg' }],
    loadData: async () => {
      throw new Error('offline')
    },
  })
  assert.equal((await box.run(TOOL_NAMES.PREVIEW_RECIPES, {})).error, 'tool_failed')
})

test('find_recipes reaches recipes the context summary leaves out', async () => {
  const recipes = nineRecipes()
  assert.equal(candidateRecipeIds(contextFor(recipes)).includes('R008'), false)

  const result = await toolbox({ recipes }).run(TOOL_NAMES.FIND_RECIPES, { uses_ingredients: ['tomato'] })
  assert.equal(result.total_matches, 1)
  assert.equal(result.recipes[0].recipe_id, 'R008')
})

test('find_recipes matches plural names and applies every filter', async () => {
  const recipes = [
    recommendation({ id: 'R001', mealType: 'Breakfast', ingredients: ['egg', 'bread'], missing: [] }),
    recommendation({ id: 'R002', mealType: 'Breakfast', ingredients: ['egg', 'bacon'], missing: ['bacon'] }),
    recommendation({ id: 'R003', mealType: 'Dinner', ingredients: ['egg', 'rice'], missing: [] }),
  ]
  const result = await toolbox({ recipes }).run(TOOL_NAMES.FIND_RECIPES, {
    uses_ingredients: ['Eggs'],
    max_missing_ingredients: 0,
    meal_type: 'breakfast',
  })
  assert.deepEqual(result.recipes.map(recipe => recipe.recipe_id), ['R001'])
})

test('find_recipes caps what it returns but reports the full count', async () => {
  const recipes = Array.from({ length: 12 }, (unused, index) => recommendation({ id: `R${100 + index}` }))
  const result = await toolbox({ recipes }).run(TOOL_NAMES.FIND_RECIPES, {})
  assert.equal(result.total_matches, 12)
  assert.equal(result.recipes.length, MAX_FIND_RESULTS)
})

test('A recipe the Recommendations screen hides cannot be reached by a tool', async () => {
  const recipes = [
    recommendation({ id: 'R001' }),
    recommendation({ id: 'R002', coverageScore: 0 }),
  ]
  const box = toolbox({ recipes })
  assert.deepEqual(box.allowedRecipeIds(), ['R001'])
  assert.equal((await box.run(TOOL_NAMES.GET_RECIPE_DETAILS, { recipe_id: 'R002' })).error, 'not_on_list')
})

test('get_recipe_nutrition returns figures rounded the way the panel shows them', async () => {
  const result = await toolbox().run(TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })
  assert.equal(result.available, true)
  assert.deepEqual(result.per_serving, {
    kcal: 312, protein_g: 12.4, carbs_g: 30.1, fat_g: 15.2, fibre_g: 4.1, sodium_mg: 380,
  })
})

test('get_recipe_nutrition says when a recipe has no nutrition data', async () => {
  const box = toolbox({ recipes: [recommendation({ id: 'R001', nutrition: { available: false } })] })
  const result = await box.run(TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })
  assert.equal(result.available, false)
  assert.equal('per_serving' in result, false)
})

test('check_ingredient flags an ingredient the user has to avoid', async () => {
  const result = await toolbox({ allergies: ['No eggs'] }).run(TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'Eggs' })
  assert.equal(result.allowed, false)
  assert.deepEqual(result.conflicts, [{ preference: 'no_eggs', kind: 'allergen' }])
})

test('check_ingredient will not vouch for an ingredient outside the app rules', async () => {
  const box = toolbox({ allergies: ['No nuts'] })

  const cashew = await box.run(TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'cashews' })
  assert.equal(cashew.allowed, true)
  assert.equal(cashew.verified, false)
  assert.ok(cashew.note)

  const bread = await box.run(TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'bread' })
  assert.equal(bread.verified, true)
})

test('check_ingredient cannot verify anything for an allergy the app has no rule for', async () => {
  const result = await toolbox({ allergies: ['No milk'] }).run(TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'bread' })
  assert.equal(result.verified, false)
  assert.match(result.note, /no_milk/)
})

test('With no allergens or diets set there is nothing to conflict with', async () => {
  const result = await toolbox().run(TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'cinnamon' })
  assert.equal(result.allowed, true)
  assert.equal(result.verified, true)
})

test('On the ingredient screens the recipe book counts as known ingredients', async () => {
  const { box } = ingredientBox({ allergies: ['No nuts'] })
  const onion = await box.run(TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'onion' })
  assert.equal(onion.verified, true)
})

test('preview_recipes ranks the recipe book the way the app does', async () => {
  const { box, loads } = ingredientBox()
  const result = await box.run(TOOL_NAMES.PREVIEW_RECIPES, {})

  assert.equal(result.source, 'SnapWell recipe book')
  assert.equal(result.total_matches, 3)
  assert.equal(result.strong_matches, 0)
  assert.deepEqual(result.recipes.map(recipe => recipe.recipe_id), ['B001', 'B002', 'B005'])
  assert.deepEqual(result.recipes[0].missing_ingredients, ['butter'])

  // Recipes the model has now seen may be cited; the book is loaded once per turn
  assert.deepEqual(box.allowedRecipeIds().sort(), ['B001', 'B002', 'B005'])
  await box.run(TOOL_NAMES.PREVIEW_RECIPES, { max_missing_ingredients: 1 })
  assert.equal(loads(), 1)
})

test('suggest_additions ranks by recipes unlocked, then by coverage gained', async () => {
  const { box } = ingredientBox()
  const result = await box.run(TOOL_NAMES.SUGGEST_ADDITIONS, {})

  // butter, tomato and prawn each unlock one recipe; butter also lifts Butter
  // rice by 50 points, tomato lifts Tomato salad by 33, prawn lifts nothing else
  assert.deepEqual(result.suggestions.map(item => item.ingredient), ['butter', 'tomato', 'prawn'])
  assert.equal(result.suggestions[0].recipes_unlocked, 1)
  assert.equal(result.suggestions[0].recipes_improved, 2)
  assert.deepEqual(result.suggestions[0].unlocked_recipes, [
    { recipe_id: 'B001', name: 'Egg toast', coverage_after: 100 },
  ])
  assert.equal(result.strong_matches_now, 0)
  assert.ok(box.allowedRecipeIds().includes('B005'))
})

test('suggest_additions never proposes what the user\'s settings rule out', async () => {
  const shellfish = await ingredientBox({ allergies: ['No shellfish'] }).box.run(TOOL_NAMES.SUGGEST_ADDITIONS, {})
  assert.equal(shellfish.suggestions.some(item => item.ingredient === 'prawn'), false)

  const dairyFree = await ingredientBox({ diets: ['Dairy-free'] }).box.run(TOOL_NAMES.SUGGEST_ADDITIONS, {})
  assert.equal(dairyFree.suggestions.some(item => item.ingredient === 'butter'), false)
})

test('suggest_additions keeps its count between one and the cap', async () => {
  const { box } = ingredientBox()
  assert.equal((await box.run(TOOL_NAMES.SUGGEST_ADDITIONS, { max_suggestions: 1 })).suggestions.length, 1)
  assert.equal((await box.run(TOOL_NAMES.SUGGEST_ADDITIONS, { max_suggestions: 0 })).suggestions.length, 1)
})

test('get_list_nutrition totals the list at the quantities entered', async () => {
  const { box } = ingredientBox()
  const result = await box.run(TOOL_NAMES.GET_LIST_NUTRITION, {})

  // Two eggs at 50 g each, and one slice of bread (34 g) because "piece" has no
  // conversion for bread and the standard portion is used instead
  assert.equal(result.available, true)
  assert.match(result.basis, /whole ingredient list/)
  assert.deepEqual(result.total, {
    kcal: 228, protein_g: 15.7, carbs_g: 18, fat_g: 11, fibre_g: 0.7, sodium_mg: 276,
  })
  assert.deepEqual(result.ingredients.map(item => [item.ingredient, item.grams]), [['egg', 100], ['bread', 34]])
})

test('get_list_nutrition can cost one ingredient, and refuses one not on the list', async () => {
  const { box } = ingredientBox()
  const eggs = await box.run(TOOL_NAMES.GET_LIST_NUTRITION, { ingredient: 'eggs' })
  assert.equal(eggs.total.kcal, 143)
  assert.equal(eggs.total.protein_g, 13)

  assert.equal((await box.run(TOOL_NAMES.GET_LIST_NUTRITION, { ingredient: 'rice' })).error, 'not_on_list')
})

test('The context summary carries no nutrition figures', () => {
  const pack = contextFor([recommendation({ id: 'R001' })])
  assert.equal(pack.candidate_recipes[0].nutrition_available, true)
  assert.equal('nutrition_per_serving' in pack.candidate_recipes[0], false)
  assert.equal(JSON.stringify(pack).includes('312'), false)
})

test('The ingredient-stage context carries no recipe summary', () => {
  const pack = buildChatContext({
    stage: CHAT_STAGES.INGREDIENTS,
    ingredients: [{ label: 'egg' }],
    recommendationResult: { recommendations: [recommendation({ id: 'R001' })] },
  })
  assert.equal(pack.stage, CHAT_STAGES.INGREDIENTS)
  assert.deepEqual(pack.candidate_recipes, [])
})

test('A figure that matches the nutrition tool result is kept', async () => {
  const box = toolbox()
  const result = verifyChatAnswer({
    answer: { answer: 'It has 12.4 g of protein and 312 kcal per serve.', cited_recipe_ids: ['R001'] },
    context: contextFor([recommendation({ id: 'R001' })]),
    toolCalls: [await call(box, TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })],
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.text, 'It has 12.4 g of protein and 312 kcal per serve.')
  assert.equal(result.verifiedNumbers, 2)
  assert.equal(result.redactedNumbers, 0)
})

test('A list total from the nutrition tool is verified the same way', async () => {
  const { box } = ingredientBox()
  const result = verifyChatAnswer({
    answer: { answer: 'Your list comes to 228 kcal and 15.7 g of protein in total.', cited_recipe_ids: [] },
    context: buildChatContext({ stage: CHAT_STAGES.INGREDIENTS, ingredients: [{ label: 'egg' }] }),
    toolCalls: [await call(box, TOOL_NAMES.GET_LIST_NUTRITION, {})],
  })
  assert.equal(result.verifiedNumbers, 2)
  assert.equal(result.redactedNumbers, 0)
})

test('A figure that differs from the tool result is removed', async () => {
  const box = toolbox()
  const result = verifyChatAnswer({
    answer: { answer: 'It has about 13 g of protein.', cited_recipe_ids: ['R001'] },
    context: contextFor([recommendation({ id: 'R001' })]),
    toolCalls: [await call(box, TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })],
  })
  assert.equal(result.redactedNumbers, 1)
  assert.ok(result.text.includes(NUTRITION_PLACEHOLDER))
})

test('A real figure quoted against the wrong nutrient is removed', async () => {
  const box = toolbox()
  const result = verifyChatAnswer({
    answer: { answer: 'It has 30.1 g of protein.', cited_recipe_ids: ['R001'] },
    context: contextFor([recommendation({ id: 'R001' })]),
    toolCalls: [await call(box, TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })],
  })
  assert.equal(result.verifiedNumbers, 0)
  assert.equal(result.redactedNumbers, 1)
})

test('A kilojoule figure is removed because the tool reports kilocalories', async () => {
  const box = toolbox()
  const result = verifyChatAnswer({
    answer: { answer: 'That is 1307 kJ per serve.', cited_recipe_ids: ['R001'] },
    context: contextFor([recommendation({ id: 'R001' })]),
    toolCalls: [await call(box, TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })],
  })
  assert.equal(result.redactedNumbers, 1)
})

test('Two verified figures in one sentence are each checked once', async () => {
  const box = toolbox()
  const text = 'Per serve: protein 12.4 g and fat 15.2 g.'
  const result = verifyChatAnswer({
    answer: { answer: text, cited_recipe_ids: ['R001'] },
    context: contextFor([recommendation({ id: 'R001' })]),
    toolCalls: [await call(box, TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })],
  })
  assert.equal(result.text, text)
  assert.equal(result.verifiedNumbers, 2)
  assert.equal(result.redactedNumbers, 0)
})

test('A recipe reached through a tool may be cited, and nothing outside the list may', () => {
  const recipes = nineRecipes()
  const box = toolbox({ recipes })
  const context = contextFor(recipes)
  const answer = { answer: 'Try the tomato rice.', cited_recipe_ids: ['R008'] }

  assert.equal(verifyChatAnswer({ answer, context }).reason, BLOCK_REASONS.UNKNOWN_RECIPE)
  assert.equal(verifyChatAnswer({ answer, context, allowedRecipeIds: box.allowedRecipeIds() }).status, 'ok')
  assert.equal(
    verifyChatAnswer({
      answer: { answer: 'Try this.', cited_recipe_ids: ['R999'] },
      context,
      allowedRecipeIds: box.allowedRecipeIds(),
    }).reason,
    BLOCK_REASONS.UNKNOWN_RECIPE,
  )
})

test('On the ingredient screens a book recipe may be cited only after a tool returned it', async () => {
  const { box } = ingredientBox()
  const context = buildChatContext({ stage: CHAT_STAGES.INGREDIENTS, ingredients: [{ label: 'egg' }] })
  const answer = { answer: 'Egg toast is closest.', cited_recipe_ids: ['B001'] }

  assert.equal(verifyChatAnswer({ answer, context, allowedRecipeIds: box.allowedRecipeIds() }).status, 'blocked')
  await box.run(TOOL_NAMES.PREVIEW_RECIPES, {})
  assert.equal(verifyChatAnswer({ answer, context, allowedRecipeIds: box.allowedRecipeIds() }).status, 'ok')
})

test('A warning about an ingredient the tool flagged is stated by the app, not the model', async () => {
  const box = toolbox({ allergies: ['No nuts'] })
  const context = contextFor([recommendation({ id: 'R001' })], { allergies: ['No nuts'] })
  const answer = { answer: 'Add peanut butter on top, it is lovely.', cited_recipe_ids: [] }

  const checked = verifyChatAnswer({
    answer,
    context,
    toolCalls: [await call(box, TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'peanut butter' })],
  })
  assert.equal(checked.status, 'ok')
  assert.equal(checked.answeredByApp, true)
  // The model's wording never reaches the screen, whatever it said
  assert.equal(checked.text.includes('lovely'), false)
  assert.match(checked.text, /Peanut butter conflicts with your "No nuts" setting/)

  const unchecked = verifyChatAnswer({ answer, context })
  assert.equal(unchecked.status, 'blocked')
  assert.equal(unchecked.reason, BLOCK_REASONS.ALLERGEN)
})

test('A tool check on one ingredient does not clear a different one', async () => {
  const box = toolbox({ allergies: ['No nuts', 'No eggs'] })
  const result = verifyChatAnswer({
    answer: { answer: 'Beat in two eggs.', cited_recipe_ids: [] },
    context: contextFor([recommendation({ id: 'R001' })], { allergies: ['No nuts', 'No eggs'] }),
    toolCalls: [await call(box, TOOL_NAMES.CHECK_INGREDIENT, { ingredient: 'peanut butter' })],
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.violations[0].value, 'egg')
})

async function checkFigures(text, recipe = recommendation({ id: 'R001' })) {
  const box = toolbox({ recipes: [recipe] })
  return verifyChatAnswer({
    answer: { answer: text, cited_recipe_ids: ['R001'] },
    context: contextFor([recipe]),
    toolCalls: [await call(box, TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'R001' })],
  })
}

test('Each figure in a listed run of nutrients is checked against its own nutrient', async () => {
  // The shape a phone screenshot showed half-redacted: every figure named after
  // it, so pairing each with the nutrient before it paired it with a neighbour
  const text = 'Each serving has 312 kcal, 12.4 g of protein, 15.2 g of fat, '
    + '30.1 g of carbohydrates, 4.1 g of fibre, and 380 mg of sodium.'
  const result = await checkFigures(text)
  assert.equal(result.text, text)
  assert.equal(result.verifiedNumbers, 6)
  assert.equal(result.redactedNumbers, 0)
})

test('In a list, only the figure that is wrong is removed', async () => {
  const result = await checkFigures('It has 12.4 g of protein, 16 g of fat and 30.1 g of carbohydrates.')
  assert.equal(result.verifiedNumbers, 2)
  assert.equal(result.redactedNumbers, 1)
  assert.equal(
    result.text,
    `It has 12.4 g of protein, ${NUTRITION_PLACEHOLDER} of fat and 30.1 g of carbohydrates.`,
  )
})

test('Nutrients named before their figures are paired the same way', async () => {
  const result = await checkFigures('Per serve — protein: 12.4 g, fat: 15.2 g, sodium: 380 mg.')
  assert.equal(result.verifiedNumbers, 3)
  assert.equal(result.redactedNumbers, 0)
})

test('A zero figure is verified like any other', async () => {
  const recipe = recommendation({
    id: 'R001',
    nutrition: {
      available: true,
      partial: true,
      perServing: { kcal: 22.3, protein: 1.12, carbs: 3.9, fat: 0.02, fibre: 0.8, sodium: 45.2 },
    },
  })
  const text = 'Each serving contains 22 kcal, 1.1 g of protein, 0 g of fat, 3.9 g of carbohydrates, '
    + '0.8 g of fibre, and 45 mg of sodium based on partial data.'
  const result = await checkFigures(text, recipe)
  assert.equal(result.text, text)
  assert.equal(result.verifiedNumbers, 6)
})

test('A recipe id written next to its name is taken out of the text', () => {
  const recipe = recommendation({ id: 'R074', name: 'Pork pumpkin plate' })
  const result = verifyChatAnswer({
    answer: {
      answer: 'The other available recipe is the Pork pumpkin plate (R074), which you can make by adding pork.',
      cited_recipe_ids: ['R074'],
    },
    context: contextFor([recipe]),
  })
  assert.equal(result.text, 'The other available recipe is the Pork pumpkin plate, which you can make by adding pork.')
  assert.deepEqual(result.citedRecipeIds, ['R074'])
})

test('A recipe id standing in for the name is replaced by the name', () => {
  const recipe = recommendation({ id: 'R074', name: 'Pork pumpkin plate' })
  const result = verifyChatAnswer({
    answer: { answer: 'Try recipe R074 tonight [ID: R074].', cited_recipe_ids: ['R074'] },
    context: contextFor([recipe]),
  })
  assert.equal(result.text, 'Try Pork pumpkin plate tonight.')
})

test('A recipe reached through a tool is named from the tool result', async () => {
  const { box } = ingredientBox()
  await box.run(TOOL_NAMES.PREVIEW_RECIPES, {})
  const result = verifyChatAnswer({
    answer: { answer: 'B005 is the closest match (B005).', cited_recipe_ids: ['B005'] },
    context: buildChatContext({ stage: CHAT_STAGES.INGREDIENTS, ingredients: [{ label: 'egg' }] }),
    allowedRecipeIds: box.allowedRecipeIds(),
    recipeNames: box.recipeNames(),
  })
  assert.equal(result.text, 'Prawn toast is the closest match.')
})

test('Nutrition for a generated recipe without its own amounts is flagged as an estimate', async () => {
  const perServing = { kcal: 170.8, protein: 9.4, carbs: 17.7, fat: 7.2, fibre: 1.4, sodium: 220 }
  const estimated = recommendation({
    id: 'AI001',
    source: 'online',
    nutrition: { available: true, partial: false, quantitiesFromRecipe: false, perServing },
  })
  const exact = recommendation({
    id: 'AI002',
    source: 'online',
    nutrition: { available: true, partial: false, quantitiesFromRecipe: true, perServing },
  })
  const box = toolbox({ recipes: [estimated, exact] })

  assert.match((await box.run(TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'AI001' })).note, /Estimated/)
  assert.equal('note' in (await box.run(TOOL_NAMES.GET_RECIPE_NUTRITION, { recipe_id: 'AI002' })), false)
})

test('The home screen offers only the app guide, and every stage can reach it', async () => {
  const home = createChatToolbox({ stage: CHAT_STAGES.HOME })
  assert.deepEqual(home.declarations.map(declaration => declaration.name), [TOOL_NAMES.GET_APP_HELP])
  assert.equal((await home.run(TOOL_NAMES.FIND_RECIPES, {})).error, 'unknown_tool')

  const result = await home.run(TOOL_NAMES.GET_APP_HELP, { topic: 'local vs online mode' })
  assert.equal(result.source, 'SnapWell app guide')
  assert.equal(result.sections[0].id, 'modes')

  for (const stage of Object.values(CHAT_STAGES)) {
    const declared = createChatToolbox({ stage }).declarations.map(declaration => declaration.name)
    assert.ok(declared.includes(TOOL_NAMES.GET_APP_HELP), stage)
  }
})
