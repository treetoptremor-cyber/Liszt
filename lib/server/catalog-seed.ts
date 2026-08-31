/**
 * Starter catalog: the grocery category taxonomy plus a few hundred common
 * canonical items and the everyday phrasings that map onto them.
 *
 * Seeded idempotently by `createDb()` (see lib/db.ts). Category slugs are
 * stable forever — they are what analytics rolls up by. Display names are
 * editable, and deliberately match the client's own `CATEGORIES` list
 * (lib/categories.ts) so a server-filled category groups under the same
 * heading a user-picked one would.
 *
 * Aliases are normalized through `normalizeItemKey` at seed time, so entries
 * here can be written the way a person would type them. Every item's own
 * `key` is registered as an alias automatically.
 */

import { randomUUID } from "crypto";
import { normalizeItemKey } from "@/lib/normalize";

export interface SeedCategory {
  slug: string;
  name: string;
  sortOrder: number;
}

export interface SeedItem {
  key: string;
  name: string;
  /** Category slug. */
  category: string;
  aliases?: string[];
}

/** Flat and aisle-ordered. `sortOrder` leaves gaps so curated categories can
 *  be slotted between these without renumbering. */
export const SEED_CATEGORIES: SeedCategory[] = [
  { slug: "produce", name: "Produce", sortOrder: 10 },
  { slug: "bakery", name: "Bakery", sortOrder: 20 },
  { slug: "meat-seafood", name: "Meat & Fish", sortOrder: 30 },
  { slug: "dairy-eggs", name: "Dairy & Eggs", sortOrder: 40 },
  { slug: "frozen", name: "Frozen", sortOrder: 50 },
  { slug: "pantry", name: "Pantry", sortOrder: 60 },
  { slug: "snacks", name: "Snacks", sortOrder: 70 },
  { slug: "beverages", name: "Drinks", sortOrder: 80 },
  { slug: "household", name: "Household", sortOrder: 90 },
  { slug: "personal-care", name: "Personal care", sortOrder: 100 },
  { slug: "baby", name: "Baby", sortOrder: 110 },
  { slug: "pet", name: "Pet", sortOrder: 120 },
  { slug: "other", name: "Other", sortOrder: 130 },
];

export const SEED_ITEMS: SeedItem[] = [
  // ---- Produce -------------------------------------------------------
  { key: "apple", name: "Apples", category: "produce", aliases: ["apples", "green apples", "red apples", "gala apples", "honeycrisp"] },
  { key: "banana", name: "Bananas", category: "produce", aliases: ["bananas"] },
  { key: "orange", name: "Oranges", category: "produce", aliases: ["oranges", "clementines", "mandarins"] },
  { key: "lemon", name: "Lemons", category: "produce", aliases: ["lemons"] },
  { key: "lime", name: "Limes", category: "produce", aliases: ["limes"] },
  { key: "grapes", name: "Grapes", category: "produce", aliases: ["grape", "red grapes", "green grapes"] },
  { key: "strawberries", name: "Strawberries", category: "produce", aliases: ["strawberry"] },
  { key: "blueberries", name: "Blueberries", category: "produce", aliases: ["blueberry"] },
  { key: "raspberries", name: "Raspberries", category: "produce", aliases: ["raspberry"] },
  { key: "blackberries", name: "Blackberries", category: "produce", aliases: ["blackberry"] },
  { key: "avocado", name: "Avocados", category: "produce", aliases: ["avocados"] },
  { key: "tomato", name: "Tomatoes", category: "produce", aliases: ["tomatoes", "cherry tomatoes", "roma tomatoes", "vine tomatoes"] },
  { key: "potato", name: "Potatoes", category: "produce", aliases: ["potatoes", "russet potatoes", "baby potatoes", "new potatoes"] },
  { key: "sweet potato", name: "Sweet potatoes", category: "produce", aliases: ["sweet potatoes", "yam", "yams"] },
  { key: "onion", name: "Onions", category: "produce", aliases: ["onions", "yellow onion", "red onion", "white onion"] },
  { key: "garlic", name: "Garlic", category: "produce", aliases: ["garlic cloves", "head of garlic"] },
  { key: "carrot", name: "Carrots", category: "produce", aliases: ["carrots", "baby carrots"] },
  { key: "broccoli", name: "Broccoli", category: "produce" },
  { key: "cauliflower", name: "Cauliflower", category: "produce" },
  { key: "spinach", name: "Spinach", category: "produce", aliases: ["baby spinach"] },
  { key: "lettuce", name: "Lettuce", category: "produce", aliases: ["romaine", "romaine lettuce", "iceberg lettuce"] },
  { key: "salad mix", name: "Salad", category: "produce", aliases: ["salad", "mixed greens", "salad greens", "spring mix", "bagged salad"] },
  { key: "cucumber", name: "Cucumber", category: "produce", aliases: ["cucumbers"] },
  { key: "zucchini", name: "Zucchini", category: "produce", aliases: ["courgette", "courgettes"] },
  { key: "bell pepper", name: "Bell peppers", category: "produce", aliases: ["bell peppers", "peppers", "red pepper", "green pepper", "red peppers", "green peppers"] },
  { key: "mushrooms", name: "Mushrooms", category: "produce", aliases: ["mushroom"] },
  { key: "celery", name: "Celery", category: "produce" },
  { key: "kale", name: "Kale", category: "produce" },
  { key: "corn", name: "Corn", category: "produce", aliases: ["corn on the cob", "sweetcorn"] },
  { key: "ginger", name: "Ginger", category: "produce", aliases: ["fresh ginger"] },
  { key: "cilantro", name: "Cilantro", category: "produce", aliases: ["coriander", "fresh coriander"] },
  { key: "parsley", name: "Parsley", category: "produce" },
  { key: "basil", name: "Basil", category: "produce", aliases: ["fresh basil"] },
  { key: "green onions", name: "Green onions", category: "produce", aliases: ["scallions", "spring onions", "green onion"] },
  { key: "mango", name: "Mango", category: "produce", aliases: ["mangoes", "mangos"] },
  { key: "pear", name: "Pears", category: "produce", aliases: ["pears"] },
  { key: "peach", name: "Peaches", category: "produce", aliases: ["peaches"] },
  { key: "melon", name: "Melon", category: "produce", aliases: ["cantaloupe", "honeydew"] },
  { key: "watermelon", name: "Watermelon", category: "produce" },
  { key: "pineapple", name: "Pineapple", category: "produce" },
  { key: "kiwi", name: "Kiwi", category: "produce", aliases: ["kiwis"] },
  { key: "grapefruit", name: "Grapefruit", category: "produce" },
  { key: "asparagus", name: "Asparagus", category: "produce" },
  { key: "green beans", name: "Green beans", category: "produce", aliases: ["green bean", "string beans"] },
  { key: "brussels sprouts", name: "Brussels sprouts", category: "produce", aliases: ["brussel sprouts"] },
  { key: "cabbage", name: "Cabbage", category: "produce" },
  { key: "eggplant", name: "Eggplant", category: "produce", aliases: ["aubergine"] },
  { key: "squash", name: "Squash", category: "produce", aliases: ["butternut squash", "acorn squash"] },

  // ---- Bakery --------------------------------------------------------
  { key: "bread", name: "Bread", category: "bakery", aliases: ["loaf of bread", "white bread", "whole wheat bread", "wholemeal bread", "sourdough", "sandwich bread", "rye bread"] },
  { key: "baguette", name: "Baguette", category: "bakery", aliases: ["french bread"] },
  { key: "bagels", name: "Bagels", category: "bakery", aliases: ["bagel"] },
  { key: "buns", name: "Buns", category: "bakery", aliases: ["bun", "hamburger buns", "burger buns", "hot dog buns"] },
  { key: "rolls", name: "Rolls", category: "bakery", aliases: ["roll", "dinner rolls", "bread rolls"] },
  { key: "tortillas", name: "Tortillas", category: "bakery", aliases: ["tortilla", "flour tortillas", "corn tortillas", "wraps"] },
  { key: "croissants", name: "Croissants", category: "bakery", aliases: ["croissant"] },
  { key: "muffins", name: "Muffins", category: "bakery", aliases: ["muffin"] },
  { key: "english muffins", name: "English muffins", category: "bakery", aliases: ["english muffin"] },
  { key: "pita", name: "Pita", category: "bakery", aliases: ["pita bread", "pitas"] },
  { key: "naan", name: "Naan", category: "bakery", aliases: ["naan bread"] },
  { key: "donuts", name: "Donuts", category: "bakery", aliases: ["donut", "doughnuts", "doughnut"] },
  { key: "cake", name: "Cake", category: "bakery", aliases: ["birthday cake"] },
  { key: "pie", name: "Pie", category: "bakery" },

  // ---- Meat & seafood ------------------------------------------------
  { key: "chicken", name: "Chicken", category: "meat-seafood", aliases: ["whole chicken", "chicken thighs", "chicken drumsticks", "chicken wings"] },
  { key: "chicken breast", name: "Chicken breast", category: "meat-seafood", aliases: ["chicken breasts"] },
  { key: "ground beef", name: "Ground beef", category: "meat-seafood", aliases: ["mince", "minced beef", "beef mince", "hamburger meat", "ground chuck"] },
  { key: "beef", name: "Beef", category: "meat-seafood", aliases: ["stew meat", "roast beef"] },
  { key: "steak", name: "Steak", category: "meat-seafood", aliases: ["steaks", "ribeye", "sirloin"] },
  { key: "pork", name: "Pork", category: "meat-seafood" },
  { key: "pork chops", name: "Pork chops", category: "meat-seafood", aliases: ["pork chop"] },
  { key: "bacon", name: "Bacon", category: "meat-seafood" },
  { key: "sausages", name: "Sausages", category: "meat-seafood", aliases: ["sausage", "breakfast sausage", "italian sausage", "bratwurst"] },
  { key: "ham", name: "Ham", category: "meat-seafood", aliases: ["sliced ham"] },
  { key: "turkey", name: "Turkey", category: "meat-seafood", aliases: ["ground turkey"] },
  { key: "lamb", name: "Lamb", category: "meat-seafood" },
  { key: "hot dogs", name: "Hot dogs", category: "meat-seafood", aliases: ["hot dog", "frankfurters", "wieners"] },
  { key: "deli meat", name: "Deli meat", category: "meat-seafood", aliases: ["lunch meat", "cold cuts", "sliced turkey", "deli turkey", "sandwich meat"] },
  { key: "meatballs", name: "Meatballs", category: "meat-seafood", aliases: ["meatball"] },
  { key: "salmon", name: "Salmon", category: "meat-seafood", aliases: ["salmon fillet", "salmon fillets"] },
  { key: "tuna", name: "Tuna", category: "meat-seafood", aliases: ["tuna steak"] },
  { key: "shrimp", name: "Shrimp", category: "meat-seafood", aliases: ["prawns", "prawn"] },
  { key: "cod", name: "Cod", category: "meat-seafood" },
  { key: "tilapia", name: "Tilapia", category: "meat-seafood" },
  { key: "fish", name: "Fish", category: "meat-seafood", aliases: ["white fish"] },
  { key: "crab", name: "Crab", category: "meat-seafood" },
  { key: "scallops", name: "Scallops", category: "meat-seafood", aliases: ["scallop"] },

  // ---- Dairy & eggs --------------------------------------------------
  { key: "milk", name: "Milk", category: "dairy-eggs", aliases: ["whole milk", "2% milk", "1% milk", "skim milk", "low fat milk", "fat free milk", "semi skimmed milk", "gallon of milk"] },
  { key: "oat milk", name: "Oat milk", category: "dairy-eggs", aliases: ["oatmilk", "oatly"] },
  { key: "almond milk", name: "Almond milk", category: "dairy-eggs", aliases: ["almondmilk"] },
  { key: "soy milk", name: "Soy milk", category: "dairy-eggs", aliases: ["soymilk"] },
  { key: "eggs", name: "Eggs", category: "dairy-eggs", aliases: ["egg", "dozen eggs", "a dozen eggs", "large eggs", "free range eggs"] },
  { key: "butter", name: "Butter", category: "dairy-eggs", aliases: ["unsalted butter", "salted butter"] },
  { key: "margarine", name: "Margarine", category: "dairy-eggs" },
  { key: "cheese", name: "Cheese", category: "dairy-eggs", aliases: ["sliced cheese", "shredded cheese", "grated cheese", "block of cheese"] },
  { key: "cheddar", name: "Cheddar", category: "dairy-eggs", aliases: ["cheddar cheese"] },
  { key: "mozzarella", name: "Mozzarella", category: "dairy-eggs", aliases: ["mozzarella cheese", "shredded mozzarella"] },
  { key: "parmesan", name: "Parmesan", category: "dairy-eggs", aliases: ["parmesan cheese", "parmigiano"] },
  { key: "feta", name: "Feta", category: "dairy-eggs", aliases: ["feta cheese"] },
  { key: "goat cheese", name: "Goat cheese", category: "dairy-eggs" },
  { key: "ricotta", name: "Ricotta", category: "dairy-eggs", aliases: ["ricotta cheese"] },
  { key: "cream cheese", name: "Cream cheese", category: "dairy-eggs" },
  { key: "cottage cheese", name: "Cottage cheese", category: "dairy-eggs" },
  { key: "string cheese", name: "String cheese", category: "dairy-eggs" },
  { key: "yogurt", name: "Yogurt", category: "dairy-eggs", aliases: ["yoghurt", "greek yogurt", "greek yoghurt", "plain yogurt"] },
  { key: "sour cream", name: "Sour cream", category: "dairy-eggs" },
  { key: "heavy cream", name: "Heavy cream", category: "dairy-eggs", aliases: ["whipping cream", "double cream", "cream"] },
  { key: "half and half", name: "Half and half", category: "dairy-eggs", aliases: ["half & half"] },
  { key: "whipped cream", name: "Whipped cream", category: "dairy-eggs" },
  { key: "coffee creamer", name: "Coffee creamer", category: "dairy-eggs", aliases: ["creamer"] },

  // ---- Frozen --------------------------------------------------------
  { key: "ice cream", name: "Ice cream", category: "frozen", aliases: ["icecream"] },
  { key: "frozen pizza", name: "Frozen pizza", category: "frozen" },
  { key: "frozen peas", name: "Frozen peas", category: "frozen", aliases: ["peas"] },
  { key: "frozen berries", name: "Frozen berries", category: "frozen", aliases: ["frozen fruit"] },
  { key: "frozen vegetables", name: "Frozen vegetables", category: "frozen", aliases: ["frozen veggies", "frozen veg"] },
  { key: "fish sticks", name: "Fish sticks", category: "frozen", aliases: ["fish fingers"] },
  { key: "frozen waffles", name: "Frozen waffles", category: "frozen", aliases: ["waffles"] },
  { key: "frozen fries", name: "Frozen fries", category: "frozen", aliases: ["french fries", "fries", "frozen french fries", "oven chips"] },
  { key: "chicken nuggets", name: "Chicken nuggets", category: "frozen", aliases: ["nuggets"] },
  { key: "popsicles", name: "Popsicles", category: "frozen", aliases: ["popsicle", "ice pops", "ice lollies"] },
  { key: "frozen dinner", name: "Frozen dinners", category: "frozen", aliases: ["frozen dinners", "tv dinner", "ready meals"] },

  // ---- Pantry --------------------------------------------------------
  { key: "pasta", name: "Pasta", category: "pantry", aliases: ["penne", "fusilli", "macaroni", "rigatoni"] },
  { key: "spaghetti", name: "Spaghetti", category: "pantry" },
  { key: "rice", name: "Rice", category: "pantry", aliases: ["white rice", "brown rice", "jasmine rice", "basmati rice"] },
  { key: "noodles", name: "Noodles", category: "pantry", aliases: ["ramen", "instant noodles", "egg noodles"] },
  { key: "flour", name: "Flour", category: "pantry", aliases: ["all purpose flour", "plain flour", "bread flour"] },
  { key: "sugar", name: "Sugar", category: "pantry", aliases: ["white sugar", "granulated sugar"] },
  { key: "brown sugar", name: "Brown sugar", category: "pantry" },
  { key: "powdered sugar", name: "Powdered sugar", category: "pantry", aliases: ["icing sugar", "confectioners sugar"] },
  { key: "salt", name: "Salt", category: "pantry", aliases: ["table salt", "sea salt", "kosher salt"] },
  { key: "black pepper", name: "Black pepper", category: "pantry", aliases: ["ground pepper", "peppercorns"] },
  { key: "olive oil", name: "Olive oil", category: "pantry", aliases: ["extra virgin olive oil", "evoo"] },
  { key: "vegetable oil", name: "Vegetable oil", category: "pantry", aliases: ["canola oil", "cooking oil", "oil", "sunflower oil"] },
  { key: "vinegar", name: "Vinegar", category: "pantry", aliases: ["white vinegar", "apple cider vinegar", "balsamic vinegar"] },
  { key: "ketchup", name: "Ketchup", category: "pantry" },
  { key: "mustard", name: "Mustard", category: "pantry", aliases: ["dijon mustard"] },
  { key: "mayonnaise", name: "Mayonnaise", category: "pantry", aliases: ["mayo"] },
  { key: "soy sauce", name: "Soy sauce", category: "pantry" },
  { key: "hot sauce", name: "Hot sauce", category: "pantry", aliases: ["sriracha", "tabasco"] },
  { key: "bbq sauce", name: "BBQ sauce", category: "pantry", aliases: ["barbecue sauce"] },
  { key: "salsa", name: "Salsa", category: "pantry" },
  { key: "pasta sauce", name: "Pasta sauce", category: "pantry", aliases: ["tomato sauce", "marinara", "marinara sauce", "spaghetti sauce"] },
  { key: "canned tomatoes", name: "Canned tomatoes", category: "pantry", aliases: ["crushed tomatoes", "diced tomatoes", "chopped tomatoes", "tomato paste", "passata"] },
  { key: "canned beans", name: "Canned beans", category: "pantry", aliases: ["beans", "black beans", "kidney beans", "baked beans", "refried beans"] },
  { key: "chickpeas", name: "Chickpeas", category: "pantry", aliases: ["garbanzo beans"] },
  { key: "lentils", name: "Lentils", category: "pantry" },
  { key: "canned tuna", name: "Canned tuna", category: "pantry", aliases: ["tinned tuna"] },
  { key: "canned corn", name: "Canned corn", category: "pantry" },
  { key: "soup", name: "Soup", category: "pantry", aliases: ["canned soup", "chicken noodle soup", "tomato soup"] },
  { key: "broth", name: "Broth", category: "pantry", aliases: ["stock", "chicken broth", "chicken stock", "vegetable broth", "beef broth", "bouillon"] },
  { key: "peanut butter", name: "Peanut butter", category: "pantry" },
  { key: "jam", name: "Jam", category: "pantry", aliases: ["jelly", "strawberry jam", "preserves"] },
  { key: "honey", name: "Honey", category: "pantry" },
  { key: "maple syrup", name: "Maple syrup", category: "pantry", aliases: ["syrup", "pancake syrup"] },
  { key: "nutella", name: "Nutella", category: "pantry", aliases: ["chocolate spread", "hazelnut spread"] },
  { key: "oats", name: "Oats", category: "pantry", aliases: ["oatmeal", "rolled oats", "porridge oats", "porridge"] },
  { key: "cereal", name: "Cereal", category: "pantry", aliases: ["breakfast cereal", "cornflakes"] },
  { key: "granola", name: "Granola", category: "pantry" },
  { key: "pancake mix", name: "Pancake mix", category: "pantry" },
  { key: "bread crumbs", name: "Bread crumbs", category: "pantry", aliases: ["breadcrumbs", "panko"] },
  { key: "baking powder", name: "Baking powder", category: "pantry" },
  { key: "baking soda", name: "Baking soda", category: "pantry", aliases: ["bicarbonate of soda", "bicarb"] },
  { key: "yeast", name: "Yeast", category: "pantry", aliases: ["active dry yeast"] },
  { key: "vanilla extract", name: "Vanilla extract", category: "pantry", aliases: ["vanilla"] },
  { key: "cinnamon", name: "Cinnamon", category: "pantry", aliases: ["ground cinnamon"] },
  { key: "cocoa powder", name: "Cocoa powder", category: "pantry", aliases: ["cocoa"] },
  { key: "chocolate chips", name: "Chocolate chips", category: "pantry" },
  { key: "couscous", name: "Couscous", category: "pantry" },
  { key: "quinoa", name: "Quinoa", category: "pantry" },
  { key: "olives", name: "Olives", category: "pantry" },
  { key: "pickles", name: "Pickles", category: "pantry", aliases: ["dill pickles", "gherkins"] },
  { key: "coconut milk", name: "Coconut milk", category: "pantry" },
  { key: "garlic powder", name: "Garlic powder", category: "pantry" },
  { key: "paprika", name: "Paprika", category: "pantry" },
  { key: "oregano", name: "Oregano", category: "pantry" },
  { key: "cumin", name: "Cumin", category: "pantry" },
  { key: "curry powder", name: "Curry powder", category: "pantry" },
  { key: "taco seasoning", name: "Taco seasoning", category: "pantry" },
  { key: "spices", name: "Spices", category: "pantry", aliases: ["seasoning"] },
  { key: "tofu", name: "Tofu", category: "pantry" },

  // ---- Snacks --------------------------------------------------------
  { key: "chips", name: "Chips", category: "snacks", aliases: ["potato chips", "crisps"] },
  { key: "tortilla chips", name: "Tortilla chips", category: "snacks", aliases: ["corn chips", "doritos"] },
  { key: "crackers", name: "Crackers", category: "snacks", aliases: ["saltines", "cracker"] },
  { key: "cookies", name: "Cookies", category: "snacks", aliases: ["cookie", "biscuits"] },
  { key: "chocolate", name: "Chocolate", category: "snacks", aliases: ["chocolate bar", "dark chocolate", "milk chocolate"] },
  { key: "candy", name: "Candy", category: "snacks", aliases: ["sweets", "gummies", "gummy bears"] },
  { key: "popcorn", name: "Popcorn", category: "snacks" },
  { key: "nuts", name: "Nuts", category: "snacks", aliases: ["mixed nuts"] },
  { key: "almonds", name: "Almonds", category: "snacks" },
  { key: "peanuts", name: "Peanuts", category: "snacks" },
  { key: "cashews", name: "Cashews", category: "snacks" },
  { key: "walnuts", name: "Walnuts", category: "snacks" },
  { key: "pretzels", name: "Pretzels", category: "snacks" },
  { key: "granola bars", name: "Granola bars", category: "snacks", aliases: ["granola bar", "cereal bars"] },
  { key: "protein bars", name: "Protein bars", category: "snacks", aliases: ["protein bar"] },
  { key: "trail mix", name: "Trail mix", category: "snacks" },
  { key: "dried fruit", name: "Dried fruit", category: "snacks", aliases: ["raisins", "dried cranberries"] },
  { key: "jerky", name: "Jerky", category: "snacks", aliases: ["beef jerky"] },
  { key: "rice cakes", name: "Rice cakes", category: "snacks" },
  { key: "pudding", name: "Pudding", category: "snacks" },
  { key: "hummus", name: "Hummus", category: "snacks" },
  { key: "guacamole", name: "Guacamole", category: "snacks", aliases: ["guac"] },

  // ---- Drinks --------------------------------------------------------
  { key: "coffee", name: "Coffee", category: "beverages", aliases: ["ground coffee", "coffee beans", "instant coffee", "coffee pods"] },
  { key: "tea", name: "Tea", category: "beverages", aliases: ["tea bags", "green tea", "black tea", "herbal tea"] },
  { key: "juice", name: "Juice", category: "beverages", aliases: ["apple juice", "cranberry juice"] },
  { key: "orange juice", name: "Orange juice", category: "beverages", aliases: ["oj"] },
  { key: "soda", name: "Soda", category: "beverages", aliases: ["pop", "soft drinks", "coke", "cola", "sprite", "pepsi", "fizzy drinks"] },
  { key: "water", name: "Water", category: "beverages", aliases: ["bottled water", "drinking water"] },
  { key: "sparkling water", name: "Sparkling water", category: "beverages", aliases: ["seltzer", "club soda", "fizzy water", "soda water"] },
  { key: "beer", name: "Beer", category: "beverages" },
  { key: "wine", name: "Wine", category: "beverages", aliases: ["red wine", "white wine"] },
  { key: "kombucha", name: "Kombucha", category: "beverages" },
  { key: "lemonade", name: "Lemonade", category: "beverages" },
  { key: "iced tea", name: "Iced tea", category: "beverages" },
  { key: "energy drinks", name: "Energy drinks", category: "beverages", aliases: ["energy drink", "red bull"] },
  { key: "sports drink", name: "Sports drink", category: "beverages", aliases: ["gatorade", "powerade"] },
  { key: "hot chocolate", name: "Hot chocolate", category: "beverages", aliases: ["hot cocoa", "drinking chocolate"] },
  { key: "smoothie", name: "Smoothies", category: "beverages", aliases: ["smoothies"] },

  // ---- Household -----------------------------------------------------
  { key: "paper towels", name: "Paper towels", category: "household", aliases: ["paper towel", "kitchen roll", "kitchen towel"] },
  { key: "toilet paper", name: "Toilet paper", category: "household", aliases: ["tp", "loo roll", "toilet roll", "bath tissue"] },
  { key: "tissues", name: "Tissues", category: "household", aliases: ["kleenex", "facial tissues"] },
  { key: "napkins", name: "Napkins", category: "household", aliases: ["serviettes"] },
  { key: "dish soap", name: "Dish soap", category: "household", aliases: ["washing up liquid", "dishwashing liquid", "fairy liquid"] },
  { key: "dishwasher tablets", name: "Dishwasher tablets", category: "household", aliases: ["dishwasher pods", "dishwasher detergent"] },
  { key: "laundry detergent", name: "Laundry detergent", category: "household", aliases: ["detergent", "washing powder", "laundry soap", "washing liquid"] },
  { key: "fabric softener", name: "Fabric softener", category: "household", aliases: ["fabric conditioner"] },
  { key: "dryer sheets", name: "Dryer sheets", category: "household" },
  { key: "sponges", name: "Sponges", category: "household", aliases: ["sponge", "scrub sponge"] },
  { key: "trash bags", name: "Trash bags", category: "household", aliases: ["bin bags", "garbage bags", "bin liners"] },
  { key: "aluminum foil", name: "Aluminum foil", category: "household", aliases: ["foil", "tin foil", "aluminium foil"] },
  { key: "plastic wrap", name: "Plastic wrap", category: "household", aliases: ["cling film", "saran wrap"] },
  { key: "parchment paper", name: "Parchment paper", category: "household", aliases: ["baking paper", "greaseproof paper"] },
  { key: "ziploc bags", name: "Ziploc bags", category: "household", aliases: ["ziplock bags", "sandwich bags", "freezer bags"] },
  { key: "batteries", name: "Batteries", category: "household", aliases: ["aa batteries", "aaa batteries", "battery"] },
  { key: "light bulbs", name: "Light bulbs", category: "household", aliases: ["lightbulbs", "bulbs", "light bulb"] },
  { key: "all purpose cleaner", name: "All purpose cleaner", category: "household", aliases: ["cleaner", "surface cleaner", "multi surface cleaner"] },
  { key: "bleach", name: "Bleach", category: "household" },
  { key: "glass cleaner", name: "Glass cleaner", category: "household", aliases: ["windex", "window cleaner"] },
  { key: "air freshener", name: "Air freshener", category: "household" },
  { key: "candles", name: "Candles", category: "household", aliases: ["candle"] },
  { key: "matches", name: "Matches", category: "household" },

  // ---- Personal care -------------------------------------------------
  { key: "shampoo", name: "Shampoo", category: "personal-care" },
  { key: "conditioner", name: "Conditioner", category: "personal-care" },
  { key: "body wash", name: "Body wash", category: "personal-care", aliases: ["shower gel"] },
  { key: "soap", name: "Soap", category: "personal-care", aliases: ["bar soap", "hand soap"] },
  { key: "toothpaste", name: "Toothpaste", category: "personal-care" },
  { key: "toothbrush", name: "Toothbrush", category: "personal-care", aliases: ["toothbrushes"] },
  { key: "floss", name: "Floss", category: "personal-care", aliases: ["dental floss"] },
  { key: "mouthwash", name: "Mouthwash", category: "personal-care" },
  { key: "deodorant", name: "Deodorant", category: "personal-care", aliases: ["antiperspirant"] },
  { key: "razors", name: "Razors", category: "personal-care", aliases: ["razor", "razor blades"] },
  { key: "shaving cream", name: "Shaving cream", category: "personal-care", aliases: ["shaving gel", "shaving foam"] },
  { key: "sunscreen", name: "Sunscreen", category: "personal-care", aliases: ["sunblock", "spf", "sun cream"] },
  { key: "lotion", name: "Lotion", category: "personal-care", aliases: ["body lotion", "moisturizer", "moisturiser"] },
  { key: "hand sanitizer", name: "Hand sanitizer", category: "personal-care", aliases: ["hand sanitiser"] },
  { key: "tampons", name: "Tampons", category: "personal-care" },
  { key: "sanitary pads", name: "Sanitary pads", category: "personal-care", aliases: ["pads", "menstrual pads"] },
  { key: "cotton swabs", name: "Cotton swabs", category: "personal-care", aliases: ["q tips", "qtips", "cotton buds"] },
  { key: "band aids", name: "Band aids", category: "personal-care", aliases: ["bandaids", "plasters", "bandages"] },
  { key: "ibuprofen", name: "Ibuprofen", category: "personal-care", aliases: ["advil", "nurofen", "painkillers"] },
  { key: "acetaminophen", name: "Acetaminophen", category: "personal-care", aliases: ["tylenol", "paracetamol"] },
  { key: "vitamins", name: "Vitamins", category: "personal-care", aliases: ["multivitamin", "vitamin d"] },
  { key: "contact solution", name: "Contact solution", category: "personal-care", aliases: ["contact lens solution"] },

  // ---- Baby ----------------------------------------------------------
  { key: "diapers", name: "Diapers", category: "baby", aliases: ["nappies", "diaper"] },
  { key: "baby wipes", name: "Baby wipes", category: "baby" },
  { key: "baby formula", name: "Baby formula", category: "baby", aliases: ["formula", "infant formula"] },
  { key: "baby food", name: "Baby food", category: "baby" },
  { key: "baby shampoo", name: "Baby shampoo", category: "baby" },
  { key: "diaper cream", name: "Diaper cream", category: "baby", aliases: ["nappy cream", "diaper rash cream"] },
  { key: "pacifiers", name: "Pacifiers", category: "baby", aliases: ["pacifier", "dummy", "dummies"] },
  { key: "baby bottles", name: "Baby bottles", category: "baby", aliases: ["baby bottle"] },
  { key: "sippy cups", name: "Sippy cups", category: "baby", aliases: ["sippy cup"] },
  { key: "baby lotion", name: "Baby lotion", category: "baby" },

  // ---- Pet -----------------------------------------------------------
  { key: "dog food", name: "Dog food", category: "pet" },
  { key: "cat food", name: "Cat food", category: "pet" },
  { key: "pet food", name: "Pet food", category: "pet" },
  { key: "cat litter", name: "Cat litter", category: "pet", aliases: ["litter", "kitty litter"] },
  { key: "dog treats", name: "Dog treats", category: "pet" },
  { key: "cat treats", name: "Cat treats", category: "pet" },
  { key: "poop bags", name: "Poop bags", category: "pet", aliases: ["dog poop bags"] },
  { key: "pet shampoo", name: "Pet shampoo", category: "pet" },
  { key: "bird seed", name: "Bird seed", category: "pet", aliases: ["birdseed"] },
  { key: "fish food", name: "Fish food", category: "pet" },

  // ---- Other ---------------------------------------------------------
  { key: "flowers", name: "Flowers", category: "other" },
  { key: "greeting card", name: "Greeting card", category: "other", aliases: ["birthday card", "greeting cards"] },
  { key: "gift bag", name: "Gift bags", category: "other", aliases: ["gift bags", "wrapping paper"] },
  { key: "ice", name: "Ice", category: "other", aliases: ["bag of ice"] },
  { key: "charcoal", name: "Charcoal", category: "other" },
];

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

type QueryFn = (
  text: string,
  params?: unknown[]
) => Promise<Record<string, unknown>[]>;

/** How many rows go into one multi-row INSERT. Keeps the statement (and its
 *  parameter list) a sane size while still seeding in a handful of round
 *  trips rather than a thousand. */
const BATCH = 100;

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Every item's own key doubles as an alias, so a plain "milk" matches. Each
 *  alias is normalized here rather than in the data above, so entries can be
 *  written the way someone would type them. First writer wins on a duplicate
 *  — the seed is checked for collisions, so this only absorbs a key that
 *  repeats a literal alias. */
function aliasRows(): { aliasKey: string; itemKey: string }[] {
  const seen = new Set<string>();
  const rows: { aliasKey: string; itemKey: string }[] = [];
  for (const item of SEED_ITEMS) {
    for (const raw of [item.key, ...(item.aliases ?? [])]) {
      const aliasKey = normalizeItemKey(raw);
      if (!aliasKey || seen.has(aliasKey)) continue;
      seen.add(aliasKey);
      rows.push({ aliasKey, itemKey: item.key });
    }
  }
  return rows;
}

/** A multi-row VALUES list — "($1::uuid, $2::text), ($3, $4)". Only the first
 *  tuple carries casts; that is enough for Postgres to type the whole
 *  derived table. */
function valuesList(rowCount: number, casts: string[]): string {
  const width = casts.length;
  const tuples: string[] = [];
  for (let row = 0; row < rowCount; row++) {
    const cols = casts.map((cast, col) => {
      const n = row * width + col + 1;
      return row === 0 ? `$${n}::${cast}` : `$${n}`;
    });
    tuples.push(`(${cols.join(", ")})`);
  }
  return tuples.join(", ");
}

/**
 * Insert the starter taxonomy and catalog if they aren't there yet. Runs on
 * every cold start (from `createDb`), so the fast path matters: one COUNT
 * round trip and out.
 *
 * Rows are joined on their natural keys (`slug`, `key`) rather than on
 * precomputed uuids, so a re-run after a partial seed still links correctly
 * to whatever ids the earlier run happened to generate.
 */
export async function seedCatalog(query: QueryFn): Promise<void> {
  const aliases = aliasRows();

  // Seeding only ever adds rows, so counts at or above the seed size mean
  // there is nothing left to do. Curated additions push the counts higher,
  // which is still "seeded".
  const [counts] = await query(
    `SELECT (SELECT COUNT(*) FROM item_categories)::int AS categories,
            (SELECT COUNT(*) FROM canonical_items)::int AS items,
            (SELECT COUNT(*) FROM item_aliases)::int AS aliases`
  );
  if (
    Number(counts?.categories ?? 0) >= SEED_CATEGORIES.length &&
    Number(counts?.items ?? 0) >= SEED_ITEMS.length &&
    Number(counts?.aliases ?? 0) >= aliases.length
  ) {
    return;
  }

  await query(
    `INSERT INTO item_categories (id, slug, name, sort_order)
     VALUES ${valuesList(SEED_CATEGORIES.length, ["uuid", "text", "text", "int"])}
     ON CONFLICT (slug) DO NOTHING`,
    SEED_CATEGORIES.flatMap((c) => [randomUUID(), c.slug, c.name, c.sortOrder])
  );

  for (const batch of chunk(SEED_ITEMS, BATCH)) {
    await query(
      `INSERT INTO canonical_items (id, key, name, category_id)
       SELECT v.id, v.key, v.name, c.id
       FROM (VALUES ${valuesList(batch.length, ["uuid", "text", "text", "text"])})
              AS v(id, key, name, category_slug)
       JOIN item_categories c ON c.slug = v.category_slug
       ON CONFLICT (key) DO NOTHING`,
      batch.flatMap((i) => [randomUUID(), i.key, i.name, i.category])
    );
  }

  for (const batch of chunk(aliases, BATCH)) {
    await query(
      `INSERT INTO item_aliases (alias_key, canonical_item_id)
       SELECT v.alias_key, ci.id
       FROM (VALUES ${valuesList(batch.length, ["text", "text"])})
              AS v(alias_key, item_key)
       JOIN canonical_items ci ON ci.key = v.item_key
       ON CONFLICT (alias_key) DO NOTHING`,
      batch.flatMap((a) => [a.aliasKey, a.itemKey])
    );
  }
}
