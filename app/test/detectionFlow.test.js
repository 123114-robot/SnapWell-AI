import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeDetectionsByLabel } from '../src/ai/detector.js'

test('empty detection results remain an empty confirmation input', () => {
  assert.deepEqual(mergeDetectionsByLabel([]), [])
})

test('duplicate detections merge deterministically and low-confidence noise is removed', () => {
  const detections = [
    { label: 'Apple', confidence: 0.81, quantity: 1, bbox: { x: 1 } },
    { label: 'apple', confidence: 0.94, quantity: 1, bbox: { x: 2 } },
    { label: 'banana', confidence: 0.2, quantity: 1 },
  ]
  assert.deepEqual(mergeDetectionsByLabel(detections, 0.5), [{
    id: 0,
    label: 'apple',
    confidence: 0.94,
    quantity: 2,
    unit: 'piece',
    source: 'detected',
    bbox: { x: 2 },
  }])
})
