import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { allLabels, buildKeywordIndex, matchIngredients } from '../src/ai/ingredientMatch.js'

const map = JSON.parse(readFileSync(
  new URL('../public/data/food_data/ingredient-map-v1.json', import.meta.url),
  'utf8',
))
const index = buildKeywordIndex(map)
const supported = new Set(allLabels(index).map(item => item.label))
const labelsFor = text => matchIngredients(text, index).map(item => item.label)

test('empty, low-confidence and unsupported OCR text returns no ingredients', () => {
  assert.deepEqual(labelsFor(''), [])
  assert.deepEqual(labelsFor('* xqz 17% KEEP REFRIGERATED'), [])
  assert.deepEqual(labelsFor('INGREDIENTS: dragon fruit powder, spirulina'), [])
})

test('noisy spelling variants still resolve to a supported application label', () => {
  const matches = matchIngredients('INGREDIENTS: EXTRA VIRGIN OL1VE UIL 100%', index)
  assert.equal(matches[0].label, 'olive_oil')
  assert.equal(matches[0].exact, false)
  assert.ok(matches.every(match => supported.has(match.label)))
})

test('duplicate OCR mentions return each supported ingredient only once', () => {
  const labels = labelsFor('ROLLED OATS. Ingredients: oats, oats. Serve with rolled oats.')
  assert.equal(labels.filter(label => label === 'oats').length, 1)
  assert.equal(new Set(labels).size, labels.length)
})

test('nutrition-panel noise mixed with ingredients does not invent unsupported labels', () => {
  const matches = matchIngredients(`
    NUTRITION INFORMATION PER 100G ENERGY 168KJ PROTEIN 1.5G SODIUM 284MG
    INGREDIENTS: DICED TOMATOES, EXTRA VIRGIN OLIVE OIL
  `, index)
  assert.deepEqual(matches.slice(0, 2).map(item => item.label).sort(), [
    'canned_tomatoes', 'olive_oil',
  ])
  assert.ok(matches.every(match => supported.has(match.label)))
})
