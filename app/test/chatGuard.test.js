import assert from 'node:assert/strict'
import test from 'node:test'

import { buildChatContext, candidateRecipeIds, MAX_CANDIDATE_RECIPES } from '../src/chat/chatContext.js'
import { verifyChatAnswer, BLOCK_REASONS, NUTRITION_PLACEHOLDER } from '../src/chat/chatGuard.js'

function recommendation({
  id,
  name = 'Test recipe',
  source = 'local',
  ingredients = [],
  nutrition = null,
} = {}) {
  return {
    id,
    name,
    source,
    mealType: 'dinner',
    cuisineStyle: 'Australian everyday',
    ingredients,
    steps: ['Cook it'],
    tags: [],
    coverageScore: 80,
    displayCoverageScore: 80,
    matchedIngredients: ingredients,
    missingIngredients: [],
    nutrition: nutrition ?? {
      available: true,
      partial: false,
      source: 'AUSNUT 2023 test data',
      servings: 2,
      perServing: { kcal: 312, protein: 12.4, carbs: 30.1, fat: 15.2, fibre: 4.1, sodium: 380 },
    },
  }
}

function context({
  recipes = [recommendation({ id: 'R001', name: 'Avocado toast with egg', ingredients: ['egg', 'bread'] })],
  diets = [],
  allergies = [],
  ingredients = [{ label: 'egg', quantity: 2, unit: 'piece', source: 'vision' }],
  focusedRecipeId = null,
} = {}) {
  return buildChatContext({
    ingredients,
    preferences: { diets, allergies, goals: [], mealType: null, cuisinePreference: null },
    recommendationResult: { recommendations: recipes },
    focusedRecipeId,
  })
}

function reply(answer, citedRecipeIds = ['R001']) {
  return { answer, cited_recipe_ids: citedRecipeIds }
}

test('The context pack carries no photo or detection data', () => {
  const pack = buildChatContext({
    ingredients: [{ label: 'egg', quantity: 1, unit: 'piece', source: 'vision', bbox: [1, 2, 3, 4] }],
    preferences: {},
    recommendationResult: { recommendations: [recommendation({ id: 'R001' })] },
  })
  const serialised = JSON.stringify(pack)
  assert.equal(serialised.includes('bbox'), false)
  assert.equal(serialised.includes('photo'), false)
  assert.equal(pack.ingredients[0].label, 'egg')
})

test('Preferences the guard enforces are normalised in the pack', () => {
  const pack = context({ diets: ['Vegan'], allergies: ['No nuts'] })
  assert.deepEqual(pack.preferences.diets, ['vegan'])
  assert.deepEqual(pack.preferences.allergens, ['no_nuts'])
})

test('The candidate list is capped but always includes the focused recipe', () => {
  const many = Array.from({ length: 9 }, (unused, index) =>
    recommendation({ id: `R00${index + 1}`, name: `Recipe ${index + 1}` }))
  const pack = context({ recipes: many, focusedRecipeId: 'R008' })

  assert.equal(pack.candidate_recipes.length, MAX_CANDIDATE_RECIPES + 1)
  assert.ok(candidateRecipeIds(pack).includes('R008'))
  assert.equal(pack.focused_recipe_id, 'R008')
})

test('A recipe with no nutrition data says so instead of omitting the field', () => {
  const pack = context({
    recipes: [recommendation({ id: 'R001', nutrition: { available: false } })],
  })
  assert.equal(pack.candidate_recipes[0].nutrition_available, false)
  assert.equal(pack.candidate_recipes[0].nutrition_per_serving, null)
})

test('A reply citing only whitelisted recipes passes', () => {
  const result = verifyChatAnswer({ answer: reply('Try the avocado toast.'), context: context() })
  assert.equal(result.status, 'ok')
  assert.equal(result.text, 'Try the avocado toast.')
  assert.deepEqual(result.violations, [])
})

test('A reply citing a recipe outside the candidate list is withheld', () => {
  const result = verifyChatAnswer({
    answer: reply('Try my special pasta.', ['R999']),
    context: context(),
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, BLOCK_REASONS.UNKNOWN_RECIPE)
  assert.equal(result.text, '')
  assert.equal(result.violations[0].value, 'R999')
})

test('A reply naming a declared allergen is withheld', () => {
  const result = verifyChatAnswer({
    answer: reply('Add a spoon of peanut butter for flavour.'),
    context: context({ allergies: ['No nuts'] }),
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, BLOCK_REASONS.ALLERGEN)
  assert.equal(result.violations[0].value, 'peanut_butter')
  assert.match(result.message, /No nuts/)
})

test('An allergen inside a negated sentence is still withheld', () => {
  // Fail-safe by design: no negation heuristic runs here. Withholding a correct
  // reply costs the user one message; letting an allergen through costs more.
  const result = verifyChatAnswer({
    answer: reply('This contains no peanut butter at all.'),
    context: context({ allergies: ['No nuts'] }),
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, BLOCK_REASONS.ALLERGEN)
})

test('A dietary pattern blocks the same way an allergen does', () => {
  const result = verifyChatAnswer({
    answer: reply('Crisp some bacon on top.'),
    context: context({ diets: ['Vegan'] }),
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.violations[0].trigger, 'vegan')
})

test('An ingredient name inside a longer word does not trigger a block', () => {
  const result = verifyChatAnswer({
    answer: reply('Grill the eggplant slices.'),
    context: context({ allergies: ['No eggs'] }),
  })
  assert.equal(result.status, 'ok')
})

test('A plural form of a blocked ingredient still triggers a block', () => {
  const result = verifyChatAnswer({
    answer: reply('Beat two eggs into the mix.'),
    context: context({ allergies: ['No eggs'] }),
  })
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, BLOCK_REASONS.ALLERGEN)
})

test('An energy figure is removed from the reply', () => {
  const result = verifyChatAnswer({
    answer: reply('It is roughly 450 kcal per serve.'),
    context: context(),
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.redactedNumbers, 1)
  assert.equal(result.text.includes('450'), false)
  assert.ok(result.text.includes(NUTRITION_PLACEHOLDER))
})

test('A figure next to a nutrient word is removed', () => {
  const result = verifyChatAnswer({
    answer: reply('It has about 22 g of protein and 310 mg sodium.'),
    context: context(),
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.redactedNumbers, 2)
  assert.equal(result.text.includes('22 g'), false)
  assert.equal(result.text.includes('310 mg'), false)
})

test('A cooking quantity survives, because it is not a nutrition claim', () => {
  const result = verifyChatAnswer({
    answer: reply('Add 200 g of beef mince and 2 slices of bread.'),
    context: context(),
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.redactedNumbers, 0)
  assert.ok(result.text.includes('200 g'))
})

test('Only the nutrition half of a mixed sentence is removed', () => {
  const result = verifyChatAnswer({
    answer: reply('Roughly 500 g total, giving about 28 g protein per serve.'),
    context: context(),
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.redactedNumbers, 1)
  assert.ok(result.text.includes('500 g'))
  assert.equal(result.text.includes('28 g'), false)
})

test('An empty reply is withheld rather than rendered blank', () => {
  const result = verifyChatAnswer({ answer: reply('', []), context: context() })
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, BLOCK_REASONS.EMPTY)
})

test('A plain string reply is accepted for callers that do not return JSON', () => {
  const result = verifyChatAnswer({ answer: 'Just toast the bread.', context: context() })
  assert.equal(result.status, 'ok')
  assert.deepEqual(result.citedRecipeIds, [])
})

test('A missing context blocks nothing it cannot verify but still rejects citations', () => {
  const result = verifyChatAnswer({ answer: reply('Anything.', ['R001']), context: null })
  assert.equal(result.status, 'blocked')
  assert.equal(result.reason, BLOCK_REASONS.UNKNOWN_RECIPE)
})
