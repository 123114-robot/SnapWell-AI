// 菜名关键词 → 高清美食图（Unsplash，免费可商用）
// 用法：getRecipeImage(recipeName) 返回图片 URL 或 null（null 时卡片回退到渐变色块）

const KEYWORD_IMAGES = [
  { keys: ['toast', 'bruschetta'], url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80' },
  { keys: ['sandwich', 'wrap', 'sub', 'panini'], url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&q=80' },
  { keys: ['salad', 'slaw', 'greens'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80' },
  { keys: ['pasta', 'spaghetti', 'noodle', 'noodles', 'linguine', 'penne'], url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&q=80' },
  { keys: ['soup', 'broth', 'bisque', 'chowder'], url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80' },
  { keys: ['rice', 'risotto', 'pilaf', 'fried rice'], url: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?w=600&q=80' },
  { keys: ['curry', 'masala', 'dal'], url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80' },
  { keys: ['stir', 'stir-fry', 'wok'], url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&q=80' },
  { keys: ['chicken', 'poultry'], url: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&q=80' },
  { keys: ['fish', 'salmon', 'tuna', 'seafood', 'prawn', 'shrimp'], url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80' },
  { keys: ['beef', 'steak'], url: 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=600&q=80' },
  { keys: ['egg', 'omelette', 'omelet', 'frittata', 'scrambled'], url: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&q=80' },
  { keys: ['pancake', 'waffle', 'crepe'], url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80' },
  { keys: ['smoothie', 'juice', 'shake'], url: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=600&q=80' },
  { keys: ['bowl', 'buddha', 'grain bowl'], url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80' },
  { keys: ['burger', 'patty'], url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80' },
  { keys: ['pizza', 'flatbread'], url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80' },
  { keys: ['taco', 'burrito', 'quesadilla'], url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80' },
  { keys: ['oats', 'oatmeal', 'porridge', 'muesli', 'granola'], url: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=600&q=80' },
  { keys: ['yogurt', 'yoghurt', 'parfait'], url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80' },
  { keys: ['roast', 'baked', 'bake'], url: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=80' },
  { keys: ['veg', 'vegetable', 'veggie'], url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80' },
  { keys: ['fruit', 'berry', 'banana', 'apple'], url: 'https://images.unsplash.com/photo-1564093497595-593b96d80180?w=600&q=80' },
]

export function getRecipeImage(recipeName) {
  const name = String(recipeName || '').toLowerCase()
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keys.some((k) => name.includes(k))) return entry.url
  }
  return null  // 配不上就返回 null，卡片回退到渐变
}