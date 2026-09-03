/**
 * Zero-dependency tests for the OCR text → ingredient matching layer.
 *
 *   node src/ai/ingredientMatch.test.mjs
 *
 * The inputs are real strings: the recognised text recorded in the Spike B
 * evidence set (docs/spike-b-results.en.md) plus output captured from the
 * current in-browser pipeline, including its actual character errors.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildKeywordIndex, matchIngredients, allLabels, tokenise } from './ingredientMatch.js'

const mapPath = fileURLToPath(
  new URL('../../public/data/food_data/ingredient-map-v1.json', import.meta.url),
)
const index = buildKeywordIndex(JSON.parse(readFileSync(mapPath, 'utf8')))

let passed = 0
const failures = []

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) passed += 1
  else failures.push({ name, expected, actual })
}

/** Labels the matcher returns, best first. */
const labelsFor = (text, opts) => matchIngredients(text, index, opts).map((m) => m.label)
/** Just the top label, or null. */
const topFor = (text) => labelsFor(text)[0] ?? null

// ---------------------------------------------------------------- should match

check('clean front label',
  topFor('SOLE MARE\nMACKEREL FILLETS\nIN OLIVE OIL'), 'olive_oil')

// The real error observed in the browser: Tesseract read OIL as UIL.
check('tolerates the observed O→U misread',
  topFor('MACKEREL FILLETS\nIN OLIVE UIL'), 'olive_oil')

check('ingredients panel',
  topFor('INGREDIENTS: Extra virgin olive oil (100%). CONTAINS NO ALLERGENS.'), 'olive_oil')

// Table spells it "yoghurt"; the product prints the American "Yogurt".
check('matches the alias spelling',
  topFor('FARMERS UNION\nGREEK STYLE\nAll Natural Yogurt'), 'yoghurt')

check('plural form of a table entry',
  topFor('ROLLED OATS\n750g'), 'oats')

// Packages often print only the distinguishing word: the jar says
// "BOLOGNESE", not "bolognese sauce". A multi-word keyword needs every word
// present, so each short form is its own keyword in the table.
check('short form printed on the jar',
  topFor('LEGGOS BOLOGNESE 500g'), 'pasta_sauce')

check('full form still matches',
  topFor("Leggo's Bolognese Pasta Sauce"), 'pasta_sauce')

check('other pasta-sauce short forms',
  [topFor('NAPOLETANA'), topFor('Arrabbiata 500g')],
  ['pasta_sauce', 'pasta_sauce'])

check('multi-word pantry keyword',
  topFor('Kikkoman Naturally Brewed Soy Sauce 500mL'), 'soy_sauce')

check('digit-for-letter confusion (0 read for O)',
  topFor('S0Y SAUCE'), 'soy_sauce')

check('packaged form of a vision-channel label',
  topFor('SunRice Long Grain White Rice 1kg'), 'rice')

// Both products rank above the weaker "tomato", which is also offered. In a
// tap-to-confirm UI an extra plausible candidate is cheap; a missed one is not.
check('ranks both products in one block of text',
  labelsFor('DICED TOMATOES\nEXTRA VIRGIN OLIVE OIL').slice(0, 2).sort(),
  ['canned_tomatoes', 'olive_oil'])

check('prefers the packaged entry over the fresh one',
  topFor('DICED TOMATOES 400g'), 'canned_tomatoes')

// ------------------------------------------------------------ should NOT match

check('a different product that merely contains the word',
  labelsFor('WHITE WINGS CORNFLOUR 300g').includes('corn'), false)

// A single-word keyword is one edit away from a common English word, so it
// must match exactly. Seen for real: "Read selected text locally" → "bread".
check('a single-word keyword does not fuzzy-match a common word',
  labelsFor('Read selected text locally').includes('bread'), false)

check('unrelated label text matches nothing',
  labelsFor('KEEP REFRIGERATED BELOW 4 DEGREES\nBEST BEFORE END'), [])

check('empty input',
  labelsFor(''), [])

check('OCR noise from the localisation pass',
  labelsFor('* Fi g ae |'), [])

// The words exist but belong to different lines, so this is not "olive oil".
check('rejects words scattered far apart',
  labelsFor('OLIVE GROVE ESTATE\nnet weight 500 grams\nproduce of spain\nboiled in salted water then packed in oil').includes('olive_oil'),
  false)

// ----------------------------------------------------------------- genus terms

// A pack of chicken says CHICKEN and nothing else; the table only holds
// "chicken breast" and "chicken thigh". Text cannot tell those apart, so both
// are offered rather than nothing being recognised at all.
check('offers every cut when the label names only the animal',
  labelsFor('macro ORGANIC AUSTRALIAN CHICKEN\nFREE RANGE, ORGANICALLY FED').sort(),
  ['chicken_breast', 'chicken_thigh'])

check('marks a genus suggestion as such',
  matchIngredients('ORGANIC AUSTRALIAN CHICKEN', index).every((m) => m.genus === 'chicken'),
  true)

// Naming the cut is specific evidence, so the other cut is not offered.
check('a named cut beats the genus',
  labelsFor('ORGANIC AUSTRALIAN CHICKEN BREAST FILLETS'), ['chicken_breast'])

// The guards. Without the two-label rule an allergen declaration becomes a
// shopping suggestion; without the leading-word rule "sauce" links pasta
// sauce to soy sauce.
check('an allergen declaration is not a suggestion',
  labelsFor('CONTAINS SOY. MAY CONTAIN PEANUTS.').sort(), [])

check('a shared form word is not a genus',
  labelsFor('STIR THROUGH COOKED PASTA. Simmer sauce gently.').includes('soy_sauce'),
  false)

// -------------------------------------------------------------------- plumbing

check('index covers both channels',
  new Set(index.map((e) => e.source)).size, 2)

check('every mapped label is offered in the fallback list',
  allLabels(index).length, 49)

check('every index entry carries an AUSNUT key',
  index.every((e) => Boolean(e.ausnutKey)), true)

check('tokeniser strips punctuation and case',
  tokenise('INGREDIENTS: Olive-Oil (100%)'), ['ingredient', 'olive', 'oil', '100'])

// ------------------------------------------------------------------- reporting

const total = passed + failures.length
for (const f of failures) {
  console.error(`FAIL  ${f.name}`)
  console.error(`      expected ${JSON.stringify(f.expected)}`)
  console.error(`      actual   ${JSON.stringify(f.actual)}`)
}
console.log(`${passed}/${total} passed`)
process.exit(failures.length ? 1 : 0)
