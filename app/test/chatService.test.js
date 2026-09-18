import assert from 'node:assert/strict'
import test from 'node:test'

import {
  askChat,
  buildSystemInstruction,
  CHAT_ERRORS,
  MAX_REPAIR_ATTEMPTS,
  MAX_TOOL_ROUNDS,
} from '../src/chat/chatService.js'
import { CHAT_STAGES } from '../src/chat/chatStages.js'
import { STAGE_TOOLS, TOOL_NAMES, createChatToolbox } from '../src/chat/chatTools.js'

function toolbox() {
  return createChatToolbox({
    recommendationResult: {
      recommendations: [{
        id: 'R001',
        name: 'Avocado toast with egg',
        source: 'local',
        mealType: 'breakfast',
        ingredients: ['egg', 'bread'],
        steps: ['Toast the bread'],
        tags: [],
        coverageScore: 80,
        matchedIngredients: ['egg', 'bread'],
        missingIngredients: [],
        nutrition: {
          available: true,
          partial: false,
          perServing: { kcal: 312, protein: 12.4, carbs: 30.1, fat: 15.2, fibre: 4.1, sodium: 380 },
        },
      }],
    },
    preferences: {},
  })
}

function modelTurn(parts, finishReason = 'STOP') {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { role: 'model', parts }, finishReason }] }),
  }
}

function recordingFetch(respond) {
  const requests = []
  const fetchFn = async (url, options) => {
    const body = JSON.parse(options.body)
    requests.push(body)
    return respond(body, requests.length)
  }
  return { requests, fetchFn }
}

const FINAL_REPLY = '```json\n{"answer": "It has 12.4 g of protein.", "cited_recipe_ids": ["R001"]}\n```'

test('A tool call runs locally and its result goes back before the answer', async () => {
  const { requests, fetchFn } = recordingFetch((body, count) => (count === 1
    ? modelTurn([{
      functionCall: { name: TOOL_NAMES.GET_RECIPE_NUTRITION, args: { recipe_id: 'R001' }, id: 'call_1' },
      thoughtSignature: 'sig-1',
    }])
    : modelTurn([{ text: FINAL_REPLY }])))

  const result = await askChat({ question: 'Protein?', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })

  assert.equal(result.success, true)
  assert.equal(result.answer.answer, 'It has 12.4 g of protein.')
  assert.equal(result.toolCalls.length, 1)
  assert.equal(result.toolCalls[0].result.per_serving.protein_g, 12.4)

  assert.equal(requests.length, 2)
  const followUp = requests[1].contents
  // The model's turn is sent back untouched, thought signature included
  assert.equal(followUp[1].parts[0].thoughtSignature, 'sig-1')
  const response = followUp[2].parts[0].functionResponse
  assert.equal(response.id, 'call_1')
  assert.equal(response.response.per_serving.protein_g, 12.4)
})

test('Tools and JSON response mode are never sent together', async () => {
  const { requests, fetchFn } = recordingFetch(() => modelTurn([{ text: FINAL_REPLY }]))
  await askChat({ question: 'Hi', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })

  assert.equal(requests[0].generationConfig, undefined)
  assert.deepEqual(
    requests[0].tools[0].functionDeclarations.map(declaration => declaration.name).sort(),
    [...STAGE_TOOLS[CHAT_STAGES.RECIPES]].sort(),
  )
})

test('The request carries the instruction for the toolbox\'s stage', async () => {
  const { requests, fetchFn } = recordingFetch(() => modelTurn([{ text: FINAL_REPLY }]))
  const ingredientToolbox = createChatToolbox({
    stage: CHAT_STAGES.INGREDIENTS,
    ingredients: [{ label: 'egg' }],
    loadData: async () => ({ recipes: [], ingredientNutrition: { items: [] }, ingredientPortions: { portions: {} } }),
  })
  await askChat({ question: 'Hi', context: {}, toolbox: ingredientToolbox, apiKey: 'test-key', fetchFn })

  const instruction = requests[0].system_instruction.parts[0].text
  assert.equal(instruction, buildSystemInstruction(CHAT_STAGES.INGREDIENTS))
  assert.ok(instruction.includes('suggest_additions'))
  assert.equal(buildSystemInstruction(CHAT_STAGES.RECIPES).includes('suggest_additions:'), false)
})

test('With general knowledge switched off, every stage refuses it', () => {
  for (const stage of Object.values(CHAT_STAGES)) {
    const instruction = buildSystemInstruction(stage, { allowGeneralKnowledge: false })
    assert.match(instruction, /food storage, food safety, health or medical advice/)
    assert.equal(instruction.includes('general_knowledge'), false)
  }
})

test('With general knowledge switched on, health advice and safety calls stay ruled out', () => {
  for (const stage of Object.values(CHAT_STAGES)) {
    const instruction = buildSystemInstruction(stage, { allowGeneralKnowledge: true })
    assert.match(instruction, /Never give medical or health advice/)
    assert.match(instruction, /Never judge whether a food is safe for this user to eat/)
    assert.match(instruction, /decline warmly in one short sentence, then steer back to cooking/)
    assert.match(instruction, /"general_knowledge": false, "declined": false/)
    // The verified rules are unchanged: nutrition figures still come only from tools
    assert.match(instruction, /Nutrition figures may come only from get_recipe_nutrition or get_list_nutrition/)
  }
})

test('After the round limit the model has to answer without tools', async () => {
  const { requests, fetchFn } = recordingFetch(body => (
    body.toolConfig.functionCallingConfig.mode === 'NONE'
      ? modelTurn([{ text: FINAL_REPLY }])
      : modelTurn([{ functionCall: { name: TOOL_NAMES.FIND_RECIPES, args: {} } }])
  ))

  const result = await askChat({ question: 'Anything?', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })

  assert.equal(result.success, true)
  assert.equal(requests.length, MAX_TOOL_ROUNDS + 1)
  assert.equal(result.toolCalls.length, MAX_TOOL_ROUNDS)
  assert.equal(requests.at(-1).toolConfig.functionCallingConfig.mode, 'NONE')
})

test('A reply with a sentence around the JSON is still read', async () => {
  const { fetchFn } = recordingFetch(() => modelTurn([{
    text: 'Here you go: {"answer": "Toast the bread.", "cited_recipe_ids": ["R001"]} Enjoy!',
  }]))
  const result = await askChat({ question: 'How?', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })
  assert.equal(result.success, true)
  assert.equal(result.answer.answer, 'Toast the bread.')
})

test('A reply in prose is sent back once to be reshaped as JSON', async () => {
  const { requests, fetchFn } = recordingFetch((body, count) => (count === 1
    ? modelTurn([{ text: 'Sure, toast the bread.' }])
    : modelTurn([{ text: '{"answer": "Toast the bread.", "cited_recipe_ids": []}' }])))

  const result = await askChat({ question: 'How?', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })

  assert.equal(result.success, true)
  assert.equal(result.answer.answer, 'Toast the bread.')
  assert.equal(requests.length, 2)
  const retry = requests[1]
  assert.equal(retry.contents.at(-2).parts[0].text, 'Sure, toast the bread.')
  assert.match(retry.contents.at(-1).parts[0].text, /could not read that reply/)
  assert.equal(retry.toolConfig.functionCallingConfig.mode, 'NONE')
})

test('An empty reply is asked for again without tools', async () => {
  const { requests, fetchFn } = recordingFetch((body, count) => (count === 1
    ? modelTurn([], 'OTHER')
    : modelTurn([{ text: FINAL_REPLY }])))

  const result = await askChat({ question: 'Protein?', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })

  assert.equal(result.success, true)
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1].contents, requests[0].contents)
  assert.equal(requests[1].toolConfig.functionCallingConfig.mode, 'NONE')
})

test('A reply that stays unreadable is reported with what the model sent', async () => {
  const { requests, fetchFn } = recordingFetch(() => modelTurn([{ text: 'Sure, toast the bread.' }]))
  const result = await askChat({ question: 'How?', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })

  assert.equal(result.success, false)
  assert.equal(result.errorKind, CHAT_ERRORS.BAD_RESPONSE)
  assert.equal(requests.length, 1 + MAX_REPAIR_ATTEMPTS)
  assert.deepEqual(result.detail, { finishReason: 'STOP', preview: 'Sure, toast the bread.' })
})

test('Without a toolbox the request keeps JSON response mode and sends no tools', async () => {
  const { requests, fetchFn } = recordingFetch(() => modelTurn([{ text: '{"answer": "Hi", "cited_recipe_ids": []}' }]))
  const result = await askChat({ question: 'Hi', context: {}, apiKey: 'test-key', fetchFn })
  assert.equal(result.success, true)
  assert.equal(requests[0].generationConfig.responseMimeType, 'application/json')
  assert.equal(requests[0].tools, undefined)
})

test('An HTTP error is reported as a network failure', async () => {
  const fetchFn = async () => ({ ok: false, json: async () => ({}) })
  const result = await askChat({ question: 'Hi', context: {}, toolbox: toolbox(), apiKey: 'test-key', fetchFn })
  assert.equal(result.errorKind, CHAT_ERRORS.NETWORK)
})

test('Every stage\'s instruction keeps recipe ids out of the answer text', () => {
  for (const stage of Object.values(CHAT_STAGES)) {
    assert.match(buildSystemInstruction(stage), /never write a recipe_id there/)
  }
})

test('Tools are called only when the answer needs SnapWell data', () => {
  for (const allowGeneralKnowledge of [true, false]) {
    for (const stage of Object.values(CHAT_STAGES)) {
      const instruction = buildSystemInstruction(stage, { allowGeneralKnowledge })
      assert.match(instruction, /Call a tool only when the answer depends on SnapWell's data/)
      assert.match(instruction, /Call check_ingredient only when you propose an ingredient of your own/)
      assert.equal(instruction.includes('Before suggesting any ingredient'), false)
    }
  }
})
