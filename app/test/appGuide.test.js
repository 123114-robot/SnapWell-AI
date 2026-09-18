import assert from 'node:assert/strict'
import test from 'node:test'

import { APP_GUIDE, appHelp, findHelpSections, MAX_HELP_SECTIONS } from '../src/chat/appGuide.js'
import { LOCAL_MATCH_THRESHOLD } from '../src/recommendation/recommendationEngine.js'

test('Every guide section has a unique id, a title, keywords and a body', () => {
  const ids = APP_GUIDE.map(section => section.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const section of APP_GUIDE) {
    assert.ok(section.title, section.id)
    assert.ok(section.keywords.length > 0, section.id)
    assert.ok(section.body.length > 80, section.id)
  }
})

test('A question finds the section it is about', () => {
  const cases = [
    ['local vs online mode', 'modes'],
    ['What\'s the difference between Local and Online mode?', 'modes'],
    ['what data leaves my phone', 'privacy'],
    ['scan a product barcode', 'barcode'],
    ['how are recipes recommended', 'recommendations'],
    ['where does nutrition come from', 'nutrition'],
    ['set allergies', 'settings'],
    ['take a photo of ingredients', 'snapping'],
    ['edit my ingredient list', 'ingredients'],
    ['what can the assistant do', 'assistant'],
    ['buy missing ingredients at Coles', 'recipes'],
  ]
  for (const [topic, id] of cases) {
    assert.equal(findHelpSections(topic)[0]?.id, id, topic)
  }
})

test('At most a couple of sections come back, best first', () => {
  assert.ok(findHelpSections('online mode privacy data nutrition allergy barcode').length <= MAX_HELP_SECTIONS)
})

test('A vague or unknown topic falls back to the overview and lists what else is covered', () => {
  for (const topic of ['how does it work', 'order groceries delivered to my door', '']) {
    const result = appHelp(topic)
    assert.equal(result.matched, false, topic)
    assert.equal(result.sections[0].id, 'overview', topic)
    assert.equal(result.other_topics.length, APP_GUIDE.length - 1, topic)
  }
})

test('A matched topic says so and leaves its own section out of the other topics', () => {
  const result = appHelp('local vs online mode')
  assert.equal(result.matched, true)
  assert.equal(result.source, 'SnapWell app guide')
  assert.equal(result.other_topics.includes('Local mode and Online mode'), false)
})

test('The guide quotes the engine\'s live match threshold', () => {
  const recommendations = APP_GUIDE.find(section => section.id === 'recommendations')
  assert.ok(recommendations.body.includes(`${LOCAL_MATCH_THRESHOLD}%`))
})
