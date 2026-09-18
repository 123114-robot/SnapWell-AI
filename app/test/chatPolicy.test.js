import assert from 'node:assert/strict'
import test from 'node:test'

import { buildChatContext } from '../src/chat/chatContext.js'
import { verifyChatAnswer } from '../src/chat/chatGuard.js'
import { detectHealthTopic, HEALTH_REFUSAL, shouldShowAiNote } from '../src/chat/chatPolicy.js'

test('Health questions are recognised in English and Chinese', () => {
  const questions = [
    'Is this good for diabetes?',
    'Can I eat this while pregnant?',
    'Does it raise blood pressure?',
    'Will it interact with my medication?',
    'What is the best diet plan to lose weight?',
    'Should I take a vitamin D supplement?',
    '糖尿病可以吃吗？',
    '孕期能吃南瓜吗',
    '吃药的时候能喝牛奶吗',
  ]
  for (const question of questions) {
    assert.ok(detectHealthTopic(question), question)
  }
})

test('Food that only sounds medical is left alone', () => {
  const questions = [
    'How do I cook kidney beans?',
    'Is chicken liver pâté hard to make?',
    '山药怎么做好吃？',
    'Which recipe fits my weight loss goal?',
    'How should I store spinach?',
    'Can I swap butter for olive oil?',
    'What else can I cook with pumpkin?',
  ]
  for (const question of questions) {
    assert.equal(detectHealthTopic(question), null, question)
  }
})

test('The health refusal is kind, points back to cooking, and never trips the health check', () => {
  assert.match(HEALTH_REFUSAL, /cook/i)
  assert.match(HEALTH_REFUSAL, /Dietitian/)
  assert.equal(detectHealthTopic(HEALTH_REFUSAL), null)
})

test('A reply that drifts into health advice is replaced by the app', () => {
  const result = verifyChatAnswer({
    answer: { answer: 'Pumpkin is great for keeping blood sugar steady if you are diabetic.', cited_recipe_ids: [] },
    context: buildChatContext({}),
  })
  assert.equal(result.status, 'ok')
  assert.equal(result.answeredByApp, true)
  assert.equal(result.healthRefusal, true)
  assert.equal(result.text, HEALTH_REFUSAL)
})

test('Whether a reply drew on general knowledge, or declined, is carried through the guard', () => {
  const general = verifyChatAnswer({
    answer: {
      answer: 'Wrap spinach loosely in paper towel and keep it in the crisper.',
      cited_recipe_ids: [],
      general_knowledge: true,
    },
    context: buildChatContext({}),
  })
  assert.equal(general.generalKnowledge, true)
  assert.equal(general.declined, false)

  const declined = verifyChatAnswer({
    answer: {
      answer: 'I can only help in the kitchen — want a quick idea for your eggs tonight?',
      cited_recipe_ids: [],
      general_knowledge: false,
      declined: true,
    },
    context: buildChatContext({}),
  })
  assert.equal(declined.status, 'ok')
  assert.equal(declined.declined, true)
})

test('General knowledge does not loosen the other checks', () => {
  const result = verifyChatAnswer({
    answer: {
      answer: 'A spoon of peanut butter makes it richer.',
      cited_recipe_ids: [],
      general_knowledge: true,
    },
    context: buildChatContext({ preferences: { allergies: ['No nuts'] } }),
  })
  assert.equal(result.status, 'blocked')
})

test('The AI label marks unverified answers but never a decline or the app\'s own words', () => {
  // The model's own flag
  assert.equal(shouldShowAiNote({ allowGeneral: true, generalKnowledge: true, toolCallCount: 1 }), true)
  // No tool at all, so the flag alone is not trusted
  assert.equal(shouldShowAiNote({ allowGeneral: true, toolCallCount: 0 }), true)
  // A polite decline states nothing worth double-checking
  assert.equal(shouldShowAiNote({ allowGeneral: true, toolCallCount: 0, declined: true }), false)
  // Backed by tools and not flagged
  assert.equal(shouldShowAiNote({ allowGeneral: true, toolCallCount: 2 }), false)
  // The app answered in the model's place
  assert.equal(shouldShowAiNote({ allowGeneral: true, answeredByApp: true, generalKnowledge: true }), false)
  // Switched off entirely
  assert.equal(shouldShowAiNote({ allowGeneral: false, generalKnowledge: true }), false)
})
