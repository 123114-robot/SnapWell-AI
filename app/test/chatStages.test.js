import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHAT_PAGES,
  CHAT_STAGES,
  STAGE_COPY,
  STAGE_PROMPTS,
  chatPageFor,
  chatStageFor,
  focusedRecipeIdFor,
  stageReady,
  suggestionsFor,
} from '../src/chat/chatStages.js'
import { STAGE_TOOLS } from '../src/chat/chatTools.js'

test('Each screen maps to the stage it can be grounded in', () => {
  assert.equal(chatStageFor('/'), CHAT_STAGES.HOME)
  assert.equal(chatStageFor('/confirm'), CHAT_STAGES.INGREDIENTS)
  assert.equal(chatStageFor('/quantity'), CHAT_STAGES.INGREDIENTS)
  assert.equal(chatStageFor('/recommendations'), CHAT_STAGES.RECIPES)
  assert.equal(chatStageFor('/recipe/R001'), CHAT_STAGES.RECIPES)
  assert.equal(chatStageFor('/nutrition/R001'), CHAT_STAGES.RECIPES)
  assert.equal(chatStageFor('/missing'), CHAT_STAGES.RECIPES)
})

test('Each screen maps to its own page', () => {
  assert.equal(chatPageFor('/'), CHAT_PAGES.HOME)
  assert.equal(chatPageFor('/confirm'), CHAT_PAGES.INGREDIENTS)
  assert.equal(chatPageFor('/quantity'), CHAT_PAGES.INGREDIENTS)
  assert.equal(chatPageFor('/recommendations'), CHAT_PAGES.RECOMMENDATIONS)
  assert.equal(chatPageFor('/recipe/R001'), CHAT_PAGES.RECIPE)
  assert.equal(chatPageFor('/nutrition/R001'), CHAT_PAGES.NUTRITION)
  assert.equal(chatPageFor('/missing'), CHAT_PAGES.MISSING)
})

test('Screens with nothing to stand on get no assistant', () => {
  for (const path of ['/capture', '/processing', '/preferences', '/privacy', '/product/9300000000000', '/recipe/']) {
    assert.equal(chatStageFor(path), null, path)
    assert.equal(chatPageFor(path), null, path)
  }
})

test('A stage is ready only when it has something to work from', () => {
  const ingredients = [{ label: 'egg' }]
  const withRecipes = { recommendations: [{ id: 'R001' }] }

  // The app guide is always there, so home needs nothing from the user
  assert.equal(stageReady(CHAT_STAGES.HOME, {}), true)
  assert.equal(stageReady(CHAT_STAGES.INGREDIENTS, { ingredients: [] }), false)
  assert.equal(stageReady(CHAT_STAGES.INGREDIENTS, { ingredients }), true)
  assert.equal(stageReady(CHAT_STAGES.RECIPES, { ingredients, recommendationResult: null }), false)
  assert.equal(stageReady(CHAT_STAGES.RECIPES, { ingredients, recommendationResult: withRecipes }), true)
  assert.equal(stageReady(null, { ingredients, recommendationResult: withRecipes }), false)
})

test('The focused recipe comes from the path, or from the selection on the missing screen', () => {
  assert.equal(focusedRecipeIdFor('/recipe/AI%20001'), 'AI 001')
  assert.equal(focusedRecipeIdFor('/missing', { id: 'R007' }), 'R007')
  assert.equal(focusedRecipeIdFor('/missing', null), null)
  assert.equal(focusedRecipeIdFor('/recommendations', { id: 'R007' }), null)
})

test('Every page has starter questions, and screens about a recipe name it', () => {
  for (const page of Object.values(CHAT_PAGES)) {
    assert.ok(suggestionsFor(page, 'Egg toast').length >= 2, page)
  }
  assert.ok(suggestionsFor(CHAT_PAGES.HOME).includes('How does SnapWell work?'))
  assert.ok(suggestionsFor(CHAT_PAGES.RECIPE, 'Egg toast').includes('How do I make Egg toast?'))
  assert.ok(suggestionsFor(CHAT_PAGES.MISSING, 'Egg toast').includes('What is Egg toast still missing?'))
})

test('Without a recipe name the questions still read naturally', () => {
  assert.ok(suggestionsFor(CHAT_PAGES.RECIPE, null).includes('How do I make this recipe?'))
  assert.ok(suggestionsFor(CHAT_PAGES.NUTRITION, '  ').includes('How much protein is in this recipe per serving?'))
  assert.deepEqual(suggestionsFor(null), [])
})

test('Every stage has its copy, its prompt section and its tools', () => {
  for (const stage of Object.values(CHAT_STAGES)) {
    assert.ok(STAGE_COPY[stage]?.intro(1), stage)
    assert.ok(STAGE_PROMPTS[stage], stage)
    assert.ok(STAGE_TOOLS[stage]?.length > 0, stage)
    for (const tool of STAGE_TOOLS[stage]) {
      assert.ok(STAGE_PROMPTS[stage].includes(tool), `${stage} prompt mentions ${tool}`)
    }
  }
})
