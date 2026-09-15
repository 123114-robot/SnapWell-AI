import { LOCAL_MATCH_THRESHOLD } from '../recommendation/recommendationEngine.js'

/**
 * The SnapWell app guide: what the assistant may say about the app itself.
 *
 * Every section describes behaviour the code actually has, and the one figure
 * that could drift — the strong-match threshold — is read from the engine
 * rather than written in. When a feature changes, the matching section here
 * has to change with it, or the assistant will describe the old app.
 */
export const APP_GUIDE = Object.freeze([
  {
    id: 'overview',
    title: 'How SnapWell works',
    keywords: ['start', 'begin', 'overview', 'tab', 'navigation', 'guide', 'help'],
    body: 'Snap or upload a photo of your ingredients, or type them in. Check the list SnapWell '
      + 'recognised, set the quantities, and SnapWell ranks recipes by how much of each one you '
      + 'already have. Open a recipe for its steps, what you are missing (with Coles and '
      + 'Woolworths search links) and its nutrition. The tabs along the bottom are Home, Scan '
      + '(camera), List (your ingredients), Recipes and Settings.',
  },
  {
    id: 'modes',
    title: 'Local mode and Online mode',
    keywords: ['local', 'online', 'mode', 'switch', 'badge', 'offline', 'difference'],
    body: 'Local mode runs everything on your device and uses only the built-in SnapWell recipe '
      + 'book. Online mode adds AI-generated recipes and this assistant, powered by Google Gemini. '
      + 'Switch on the Home screen, or tap the mode badge at the top of any screen. The first '
      + 'time you turn on Online mode, SnapWell shows a short notice about what is sent. '
      + 'Switching modes clears the current recipe list and the chat, so recipes are worked out '
      + 'again for the new mode.',
  },
  {
    id: 'privacy',
    title: 'Privacy and what leaves your device',
    keywords: ['privacy', 'private', 'data', 'leave', 'phone', 'device', 'send', 'sent', 'share', 'upload', 'safe', 'secure', 'gemini', 'google'],
    body: 'Your photos never leave your device: ingredient recognition and label reading both run '
      + 'on the device. In Online mode, your ingredient list (names and quantities), your '
      + 'preferences and your chat messages are sent to Google Gemini to power AI recipes and the '
      + 'assistant. Looking up a product barcode sends only the barcode number to Open Food Facts. '
      + 'Local mode sends nothing for recipes or chat.',
  },
  {
    id: 'snapping',
    title: 'Snapping your ingredients',
    keywords: ['photo', 'camera', 'picture', 'snap', 'take', 'capture', 'detect', 'recognise', 'recognize', 'library', 'image'],
    body: 'Tap Snap ingredients on the Home screen, or open the Scan tab. Then open the camera, take '
      + 'a quick photo or choose one from your library. An on-device model recognises common fresh ingredients such as eggs, tomatoes, '
      + 'spinach and chicken, and the photo is processed locally. Anything it misses you can type '
      + 'in on the next screen.',
  },
  {
    id: 'ingredients',
    title: 'Checking your ingredient list',
    keywords: ['ingredient', 'list', 'confirm', 'remove', 'delete', 'add', 'type', 'edit', 'quantity', 'amount', 'serving', 'wrong'],
    body: 'The List tab shows what SnapWell found. Remove anything wrong, type an ingredient to add '
      + 'it, or add more from a photo, an upload or a barcode. Tap Continue to set quantities and '
      + 'servings — more accurate amounts give better nutrition estimates — then tap See recipes.',
  },
  {
    id: 'recommendations',
    title: 'How recipes are recommended',
    keywords: ['recommend', 'recommendation', 'rank', 'ranking', 'match', 'coverage', 'percentage', 'generated', 'suggest', 'choose'],
    body: 'SnapWell scores each recipe in its recipe book by the share of that recipe\'s ingredients '
      + 'you already have, after removing recipes that clash with your allergy, diet and meal-type '
      + 'settings; health goals and cuisine break ties. The percentage on each card is that match. '
      + `In Online mode, when the best recipe-book match is below ${LOCAL_MATCH_THRESHOLD}%, Google `
      + 'Gemini generates recipes around your ingredients instead, and those cards are marked '
      + 'Online. If the online service cannot be reached, you see the recipe-book matches.',
  },
  {
    id: 'recipes',
    title: 'Recipe details and missing ingredients',
    keywords: ['recipe', 'detail', 'step', 'method', 'missing', 'shopping', 'buy', 'coles', 'woolworths', 'shop'],
    body: 'Tap a recipe card to see its ingredients and steps. The missing ingredients page lists '
      + 'what you still need, with search links to Coles and Woolworths for each one, and the '
      + 'nutrition page shows the recipe\'s figures per serving.',
  },
  {
    id: 'nutrition',
    title: 'Where nutrition figures come from',
    keywords: ['nutrition', 'nutrient', 'calorie', 'kcal', 'kilojoule', 'energy', 'protein', 'fat', 'carb', 'fibre', 'fiber', 'sodium', 'ausnut', 'accurate'],
    body: 'SnapWell calculates nutrition itself from AUSNUT 2023, the Australian food composition '
      + 'database, using per-100 g values and standard portion weights. Figures are per serving. '
      + 'An AI-generated recipe is costed from the amounts the recipe gives. When an ingredient '
      + 'is not in the data, the figures are marked partial and say what was left out. They are '
      + 'estimates, so check product labels when it matters.',
  },
  {
    id: 'settings',
    title: 'Preferences, allergies and diets',
    keywords: ['setting', 'preference', 'allergy', 'allergic', 'diet', 'dietary', 'vegetarian', 'vegan', 'gluten', 'dairy', 'goal', 'cuisine', 'meal'],
    body: 'The Settings tab holds your dietary preferences (such as vegetarian, vegan, gluten-free '
      + 'or dairy-free), allergies, health goals, meal type and cuisine. Allergy and diet settings '
      + 'remove clashing recipes for the ingredients SnapWell has rules for, and are checked '
      + 'against product labels in barcode reports. The rules do not cover every ingredient, so '
      + 'always check the package if you have an allergy.',
  },
  {
    id: 'barcode',
    title: 'Scanning products and labels',
    keywords: ['barcode', 'product', 'package', 'packaged', 'label', 'scan', 'ocr', 'allergen', 'trace', 'report'],
    body: 'On the Scan tab, choose Scan a product barcode, or tap Barcode on your ingredient list. '
      + 'Point the camera at the barcode or enter its digits. The product report checks the '
      + 'declared allergens and traces against your allergy settings, shows dietary status and '
      + 'nutrition per 100 g, and can add the product to your ingredients. With no barcode, read '
      + 'the ingredients and nutrition label instead: the text is read on your device. Product '
      + 'data comes from the Open Food Facts community, so always check the physical package.',
  },
  {
    id: 'assistant',
    title: 'What this assistant can do',
    keywords: ['assistant', 'chat', 'ask', 'question', 'answer', 'ai', 'help', 'bot'],
    body: 'In Online mode, the assistant is on the Home, List, Recipes and recipe screens, and the '
      + 'conversation carries across them. Suggested questions sit above the input. Answers based '
      + 'on SnapWell\'s own data show what they were checked with; general cooking tips are marked '
      + 'Generated by AI, so please double-check them. It cannot give medical or health advice.',
  },
])

export const MAX_HELP_SECTIONS = 2

// A section needs at least a keyword, or a title word backed by its body
const MIN_HELP_SCORE = 3

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'am', 'do', 'does', 'did', 'how', 'what', 'where', 'when', 'why',
  'which', 'who', 'i', 'my', 'me', 'we', 'you', 'your', 'to', 'of', 'in', 'on', 'for', 'and', 'or',
  'can', 'could', 'it', 'its', 'this', 'that', 'with', 'be', 'use', 'using', 'snapwell', 'app',
  'about', 'work', 'come', 'from', 'there', 'here', 'will', 'would', 'should', 'vs', 'versus', 'get',
])

/** Lower-case words, with a light singular so "allergies" meets "allergy". */
function tokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => {
      if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
      if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
      return word
    })
    .filter(word => !STOP_WORDS.has(word))
}

/** "recommended" meets "recommend"; short words must match exactly. */
function sameWord(token, keyword) {
  if (token === keyword) return true
  if (keyword.length >= 5 && token.startsWith(keyword)) return true
  return token.length >= 5 && keyword.startsWith(token)
}

const INDEX = APP_GUIDE.map(section => ({
  section,
  keywords: section.keywords,
  title: tokens(section.title),
  body: new Set(tokens(section.body)),
}))

/**
 * Sections most relevant to a topic, best first. A keyword hit weighs most,
 * then a word in the title, then a word in the body; ties keep guide order.
 */
export function findHelpSections(topic, limit = MAX_HELP_SECTIONS) {
  const words = [...new Set(tokens(topic))]
  if (words.length === 0) return []

  return INDEX
    .map((entry, order) => {
      let score = 0
      for (const word of words) {
        if (entry.keywords.some(keyword => sameWord(word, keyword))) score += 3
        if (entry.title.some(titleWord => sameWord(word, titleWord))) score += 2
        if (entry.body.has(word)) score += 1
      }
      return { section: entry.section, score, order }
    })
    .filter(entry => entry.score >= MIN_HELP_SCORE)
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, limit)
    .map(entry => entry.section)
}

/**
 * The get_app_help tool result. A topic the guide cannot place falls back to
 * the overview, and the other section titles always come along, so the model
 * can offer a follow-up instead of guessing.
 */
export function appHelp(topic) {
  const found = findHelpSections(topic)
  const sections = found.length > 0 ? found : [APP_GUIDE[0]]
  return {
    source: 'SnapWell app guide',
    matched: found.length > 0,
    sections: sections.map(({ id, title, body }) => ({ id, title, body })),
    other_topics: APP_GUIDE.filter(section => !sections.includes(section)).map(section => section.title),
  }
}
