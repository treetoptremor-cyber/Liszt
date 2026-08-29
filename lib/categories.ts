/** Grocery categories in roughly store-walk order, plus a keyword map used to
 *  auto-suggest a category when adding common items. Always overridable. */

export const CATEGORIES = [
  "Produce",
  "Bakery",
  "Meat & Fish",
  "Dairy & Eggs",
  "Frozen",
  "Pantry",
  "Snacks",
  "Drinks",
  "Household",
  "Personal care",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

const MAP: Record<string, Category> = {
  // Produce
  apple: "Produce", apples: "Produce", banana: "Produce", bananas: "Produce",
  orange: "Produce", oranges: "Produce", lemon: "Produce", lemons: "Produce",
  lime: "Produce", grapes: "Produce", strawberries: "Produce",
  blueberries: "Produce", raspberries: "Produce", avocado: "Produce",
  avocados: "Produce", tomato: "Produce", tomatoes: "Produce",
  potato: "Produce", potatoes: "Produce", onion: "Produce", onions: "Produce",
  garlic: "Produce", carrot: "Produce", carrots: "Produce",
  broccoli: "Produce", cauliflower: "Produce", spinach: "Produce",
  lettuce: "Produce", salad: "Produce", cucumber: "Produce",
  zucchini: "Produce", peppers: "Produce", pepper: "Produce",
  mushrooms: "Produce", celery: "Produce", kale: "Produce", corn: "Produce",
  ginger: "Produce", cilantro: "Produce", parsley: "Produce",
  basil: "Produce", scallions: "Produce", mango: "Produce", pear: "Produce",
  pears: "Produce", peach: "Produce", peaches: "Produce", melon: "Produce",
  watermelon: "Produce", pineapple: "Produce", kiwi: "Produce",
  // Bakery
  bread: "Bakery", baguette: "Bakery", bagels: "Bakery", bagel: "Bakery",
  buns: "Bakery", rolls: "Bakery", tortillas: "Bakery", croissants: "Bakery",
  muffins: "Bakery", pita: "Bakery",
  // Meat & Fish
  chicken: "Meat & Fish", beef: "Meat & Fish", pork: "Meat & Fish",
  turkey: "Meat & Fish", bacon: "Meat & Fish", sausage: "Meat & Fish",
  sausages: "Meat & Fish", ham: "Meat & Fish", salmon: "Meat & Fish",
  tuna: "Meat & Fish", shrimp: "Meat & Fish", fish: "Meat & Fish",
  steak: "Meat & Fish", mince: "Meat & Fish", meatballs: "Meat & Fish",
  // Dairy & Eggs
  milk: "Dairy & Eggs", eggs: "Dairy & Eggs", butter: "Dairy & Eggs",
  cheese: "Dairy & Eggs", yogurt: "Dairy & Eggs", yoghurt: "Dairy & Eggs",
  cream: "Dairy & Eggs", mozzarella: "Dairy & Eggs", parmesan: "Dairy & Eggs",
  cheddar: "Dairy & Eggs", feta: "Dairy & Eggs", sourcream: "Dairy & Eggs",
  "oat milk": "Dairy & Eggs", "almond milk": "Dairy & Eggs",
  "cream cheese": "Dairy & Eggs", "cottage cheese": "Dairy & Eggs",
  // Frozen
  "ice cream": "Frozen", "frozen pizza": "Frozen", "frozen peas": "Frozen",
  "frozen berries": "Frozen", "fish sticks": "Frozen",
  // Pantry
  pasta: "Pantry", spaghetti: "Pantry", rice: "Pantry", noodles: "Pantry",
  flour: "Pantry", sugar: "Pantry", salt: "Pantry", oil: "Pantry",
  "olive oil": "Pantry", vinegar: "Pantry", ketchup: "Pantry",
  mustard: "Pantry", mayo: "Pantry", mayonnaise: "Pantry", soy: "Pantry",
  "soy sauce": "Pantry", beans: "Pantry", lentils: "Pantry",
  chickpeas: "Pantry", "canned tomatoes": "Pantry", "tomato sauce": "Pantry",
  "peanut butter": "Pantry", jam: "Pantry", honey: "Pantry", oats: "Pantry",
  oatmeal: "Pantry", cereal: "Pantry", granola: "Pantry", broth: "Pantry",
  stock: "Pantry", spices: "Pantry", cinnamon: "Pantry", vanilla: "Pantry",
  "baking powder": "Pantry", yeast: "Pantry", couscous: "Pantry",
  quinoa: "Pantry",
  // Snacks
  chips: "Snacks", crackers: "Snacks", cookies: "Snacks", chocolate: "Snacks",
  candy: "Snacks", popcorn: "Snacks", nuts: "Snacks", almonds: "Snacks",
  pretzels: "Snacks", "granola bars": "Snacks",
  // Drinks
  coffee: "Drinks", tea: "Drinks", juice: "Drinks", "orange juice": "Drinks",
  soda: "Drinks", water: "Drinks", "sparkling water": "Drinks",
  beer: "Drinks", wine: "Drinks", kombucha: "Drinks", lemonade: "Drinks",
  // Household
  "paper towels": "Household", "toilet paper": "Household",
  "dish soap": "Household", detergent: "Household", "laundry detergent":
  "Household", sponges: "Household", "trash bags": "Household",
  "aluminum foil": "Household", foil: "Household", "plastic wrap": "Household",
  batteries: "Household", "light bulbs": "Household", napkins: "Household",
  "dishwasher tablets": "Household",
  // Personal care
  shampoo: "Personal care", conditioner: "Personal care",
  toothpaste: "Personal care", soap: "Personal care", deodorant:
  "Personal care", floss: "Personal care", sunscreen: "Personal care",
  lotion: "Personal care", diapers: "Personal care", wipes: "Personal care",
};

export function guessCategory(text: string): Category | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (MAP[t]) return MAP[t];
  // Try multi-word keys contained in the text, then single words.
  for (const key of Object.keys(MAP)) {
    if (key.includes(" ") && t.includes(key)) return MAP[key];
  }
  for (const word of t.split(/\s+/)) {
    if (MAP[word]) return MAP[word];
  }
  return null;
}
