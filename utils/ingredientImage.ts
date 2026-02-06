/**
 * Ingredient Image Service
 *
 * Provides fuzzy matching to find the best TheMealDB ingredient image
 * for any given ingredient name. Handles variations, typos, and compound names.
 */

import Fuse from 'fuse.js';

// Complete list of TheMealDB ingredient names (fetched from their API)
const THEMEALDB_INGREDIENTS = [
	// Proteins
	'Chicken',
	'Chicken Breast',
	'Chicken Breasts',
	'Chicken Legs',
	'Chicken Thighs',
	'Beef',
	'Beef Brisket',
	'Beef Fillet',
	'Beef Shin',
	'Lean Minced Beef',
	'Minced Beef',
	'Pork',
	'Minced Pork',
	'Lamb',
	'Lamb Leg',
	'Lamb Shoulder',
	'Lamb Loin Chops',
	'Lamb Mince',
	'Lamb Kidney',
	'Beef Kidney',
	'Veal',
	'Duck',
	'Duck Legs',
	'Turkey Mince',
	'Ham',
	'Prosciutto',
	'Parma Ham',
	'Bacon',
	'Chorizo',
	'Sausages',
	'Italian Fennel Sausages',
	'Black Pudding',
	'Doner Meat',

	// Seafood
	'Salmon',
	'Tuna',
	'Cod',
	'Salt Cod',
	'Haddock',
	'Smoked Haddock',
	'Mackerel',
	'White Fish',
	'White Fish Fillets',
	'Monkfish',
	'Pilchards',
	'Prawns',
	'King Prawns',
	'Raw King Prawns',
	'Tiger Prawns',
	'Mussels',
	'Clams',
	'Oysters',
	'Baby Squid',
	'Squid',

	// Eggs & Dairy
	'Egg',
	'Eggs',
	'Egg White',
	'Egg Yolks',
	'Free-range Egg, Beaten',
	'Free-range Eggs, Beaten',
	'Flax Eggs',
	'Butter',
	'Unsalted Butter',
	'Salted Butter',
	'Chilled Butter',
	'Vegan Butter',
	'Ghee',
	'Milk',
	'Whole Milk',
	'Semi-skimmed Milk',
	'Soya Milk',
	'Condensed Milk',
	'Coconut Milk',
	'Coconut Cream',
	'Cream',
	'Double Cream',
	'Heavy Cream',
	'Single Cream',
	'Clotted Cream',
	'Sour Cream',
	'Creme Fraiche',
	'Fromage Frais',
	'Yogurt',
	'Greek Yogurt',
	'Full Fat Yogurt',
	'Cheese',
	'Cheddar Cheese',
	'Parmesan',
	'Parmesan Cheese',
	'Parmigiano-reggiano',
	'Mozzarella',
	'Mozzarella Balls',
	'Feta',
	'Cubed Feta Cheese',
	'Gouda Cheese',
	'Gruyère',
	'Monterey Jack Cheese',
	'Shredded Monterey Jack Cheese',
	'Shredded Mexican Cheese',
	'Colby Jack Cheese',
	'Cheese Curds',
	'Cream Cheese',
	'Mascarpone',
	'Ricotta',
	'Brie',
	'Goats Cheese',
	'Stilton Cheese',
	'Pecorino',
	'Paneer',

	// Vegetables
	'Onion',
	'Onions',
	'Red Onions',
	'Chopped Onion',
	'Shallots',
	'Challots',
	'Spring Onions',
	'Leek',
	'Garlic',
	'Garlic Clove',
	'Minced Garlic',
	'Tomato',
	'Tomatoes',
	'Chopped Tomatoes',
	'Canned Tomatoes',
	'Diced Tomatoes',
	'Plum Tomatoes',
	'Cherry Tomatoes',
	'Baby Plum Tomatoes',
	'Grape Tomatoes',
	'Vine Tomatoes',
	'Sun-Dried Tomatoes',
	'Tinned Tomatos',
	'Tomato Puree',
	'Passata',
	'Potato',
	'Potatoes',
	'Small Potatoes',
	'Charlotte Potatoes',
	'Floury Potatoes',
	'Carrot',
	'Carrots',
	'Celery',
	'Celeriac',
	'Broccoli',
	'Chinese Broccoli',
	'Cauliflower',
	'Cabbage',
	'Brussels Sprouts',
	'Kale',
	'Spinach',
	'Lettuce',
	'Little Gem Lettuce',
	'Rocket',
	'Cucumber',
	'Courgettes',
	'Zucchini',
	'Aubergine',
	'Egg Plants',
	'Squash',
	'Butternut Squash',
	'Pumpkin',
	'Asparagus',
	'Green Beans',
	'Sugar Snap Peas',
	'Peas',
	'Frozen Peas',
	'Sweetcorn',
	'Creamed Corn',
	'Red Pepper',
	'Yellow Pepper',
	'Green Pepper',
	'Chilli',
	'Green Chilli',
	'Red Chilli',
	'Jalapeno',
	'Mushrooms',
	'Chestnut Mushroom',
	'Shiitake Mushrooms',
	'Wild Mushrooms',
	'Fennel',
	'Fennel Bulb',
	'Artichoke',
	'Jerusalem Artichokes',
	'Turnips',
	'Swede',
	'Avocado',
	'Chestnuts',

	// Fruits
	'Lemon',
	'Lemons',
	'Lemon Juice',
	'Lemon Zest',
	'Lime',
	'Orange',
	'Orange Zest',
	'Apple',
	'Apples',
	'Bramley Apples',
	'Braeburn Apples',
	'Banana',
	'Pears',
	'Peaches',
	'Apricot',
	'Dried Apricots',
	'Cherry',
	'Glace Cherry',
	'Strawberries',
	'Raspberries',
	'Blueberries',
	'Blackberries',
	'Redcurrants',
	'Raisins',
	'Sultanas',
	'Currants',
	'Medjool Dates',
	'Dried Fruit',
	'Fruit Mix',

	// Grains & Pasta
	'Rice',
	'Basmati Rice',
	'Brown Rice',
	'Jasmine Rice',
	'Pasta',
	'Spaghetti',
	'Penne Rigate',
	'Rigatoni',
	'Macaroni',
	'Farfalle',
	'Bowtie Pasta',
	'Lasagne Sheets',
	'Tagliatelle',
	'Fettuccine',
	'Linguine Pasta',
	'Pappardelle Pasta',
	'Paccheri Pasta',
	'Vermicelli Pasta',
	'Fideo',
	'Noodles',
	'Rice Noodles',
	'Rice Stick Noodles',
	'Rice Vermicelli',
	'Udon Noodles',
	'Egg Rolls',
	'Bread',
	'Crusty Bread',
	'Wholegrain Bread',
	'Baguette',
	'Naan Bread',
	'Breadcrumbs',
	'Couscous',
	'Oats',
	'Rolled Oats',
	'Oatmeal',
	'Mixed Grain',

	// Legumes & Beans
	'Lentils',
	'Brown Lentils',
	'French Lentils',
	'Green Red Lentils',
	'Toor Dal',
	'Chickpeas',
	'Kidney Beans',
	'Cannellini Beans',
	'Borlotti Beans',
	'Butter Beans',
	'Haricot Beans',
	'Pinto Beans',
	'Baked Beans',
	'Refried Beans',
	'Black Beans',

	// Herbs
	'Basil',
	'Basil Leaves',
	'Fresh Basil',
	'Parsley',
	'Chopped Parsley',
	'Freshly Chopped Parsley',
	'Cilantro',
	'Coriander',
	'Coriander Leaves',
	'Thyme',
	'Fresh Thyme',
	'Rosemary',
	'Oregano',
	'Dried Oregano',
	'Sage',
	'Mint',
	'Dill',
	'Chives',
	'Tarragon Leaves',
	'Marjoram',
	'Bay Leaf',
	'Bay Leaves',
	'Bouquet Garni',

	// Spices
	'Salt',
	'Sea Salt',
	'Kosher Salt',
	'Celery Salt',
	'Onion Salt',
	'Pepper',
	'Black Pepper',
	'Cayenne Pepper',
	'Red Pepper Flakes',
	'Red Chilli Flakes',
	'Red Chilli Powder',
	'Chili Powder',
	'Chilli Powder',
	'Paprika',
	'Smoked Paprika',
	'Smoky Paprika',
	'Cumin',
	'Ground Cumin',
	'Cumin Seeds',
	'Coriander Seeds',
	'Turmeric',
	'Turmeric Powder',
	'Ginger',
	'Ground Ginger',
	'Ginger Paste',
	'Ginger Garlic Paste',
	'Cinnamon',
	'Cinnamon Stick',
	'Nutmeg',
	'Cloves',
	'Cardamom',
	'Star Anise',
	'Fennel Seeds',
	'Fenugreek',
	'Mustard Seeds',
	'Saffron',
	'Curry Powder',
	'Garam Masala',
	'Biryani Masala',
	'Cajun',
	'Italian Seasoning',
	'Fajita Seasoning',
	'Harissa Spice',
	'Madras Paste',
	'Massaman Curry Paste',
	'Thai Green Curry Paste',
	'Thai Red Curry Paste',

	// Oils & Fats
	'Oil',
	'Olive Oil',
	'Extra Virgin Olive Oil',
	'Vegetable Oil',
	'Sunflower Oil',
	'Rapeseed Oil',
	'Canola Oil',
	'Peanut Oil',
	'Sesame Seed Oil',
	'Truffle Oil',
	'Goose Fat',
	'Duck Fat',
	'Lard',
	'Suet',

	// Sauces & Condiments
	'Soy Sauce',
	'Dark Soy Sauce',
	'Fish Sauce',
	'Thai Fish Sauce',
	'Oyster Sauce',
	'Worcestershire Sauce',
	'Tomato Sauce',
	'Tomato Ketchup',
	'Barbeque Sauce',
	'Hotsauce',
	'Tabasco Sauce',
	'Enchilada Sauce',
	'Salsa',
	'Green Salsa',
	'Garlic Sauce',
	'Vinegar',
	'White Vinegar',
	'Balsamic Vinegar',
	'Apple Cider Vinegar',
	'Red Wine Vinegar',
	'Vinaigrette Dressing',
	'Mustard',
	'English Mustard',
	'Dijon Mustard',
	'Mustard Powder',
	'Horseradish',
	'Tahini',
	'Peanut Butter',
	'Mirin',
	'Sake',
	'Capers',

	// Baking
	'Flour',
	'Plain Flour',
	'Self-raising Flour',
	'White Flour',
	'Corn Flour',
	'Cornstarch',
	'Potato Starch',
	'Yeast',
	'Baking Powder',
	'Bicarbonate Of Soda',
	'Sugar',
	'Caster Sugar',
	'Granulated Sugar',
	'Brown Sugar',
	'Dark Brown Sugar',
	'Light Brown Soft Sugar',
	'Dark Brown Soft Sugar',
	'Dark Soft Brown Sugar',
	'Muscovado Sugar',
	'Demerara Sugar',
	'Icing Sugar',
	'Coco Sugar',
	'Honey',
	'Maple Syrup',
	'Golden Syrup',
	'Black Treacle',
	'Treacle',
	'Vanilla',
	'Vanilla Extract',
	'Cocoa',
	'Cacao',
	'Chocolate',
	'Plain Chocolate',
	'Dark Chocolate',
	'Milk Chocolate',
	'White Chocolate',
	'Chocolate Chips',
	'Dark Chocolate Chips',
	'White Chocolate Chips',
	'Marzipan',
	'Gelatine Leafs',
	'Custard',
	'Custard Powder',
	'Desiccated Coconut',
	'Coconut',

	// Nuts & Seeds
	'Almonds',
	'Flaked Almonds',
	'Ground Almonds',
	'Walnuts',
	'Peanuts',
	'Cashews',
	'Cashew Nuts',
	'Pecan Nuts',
	'Pine Nuts',
	'Hazlenuts',
	'Nuts',
	'Sesame Seed',
	'Khus Khus',

	// Stock & Broth
	'Chicken Stock',
	'Chicken Stock Cube',
	'Beef Stock',
	'Beef Gravy',
	'Hot Beef Stock',
	'Vegetable Stock',
	'Vegetable Stock Cube',
	'Fish Stock',
	'Red Wine Jelly',

	// Wine & Alcohol
	'Red Wine',
	'White Wine',
	'Dry White Wine',
	'Brandy',
	'Stout',
	'Ginger Cordial',

	// Tortillas & Wraps
	'Tortillas',
	'Flour Tortilla',
	'Corn Tortillas',
	'Hard Taco Shells',
	'Vine Leaves',

	// Pastry
	'Puff Pastry',
	'Shortcrust Pastry',

	// Olives
	'Green Olives',
	'Black Olives',
	'Pitted Black Olives',

	// Misc
	'Water',
	'Cold Water',
	'Ice Cream',
	'Meringue Nests',
	'Digestive Biscuits',
	'Peanut Cookies',
	'Peanut Brittle',
	'Pretzels',
	'Toffee Popcorn',
	'Caramel',
	'Caramel Sauce',
	'Raspberry Jam',
	'Apricot Jam',
	'Tamarind Ball',
	'Tamarind Paste',
	'Roasted Vegetables',
	'Stir-fry Vegetables',
	'Mixed Peel',
	'Miniature Marshmallows',
	'Red Food Colouring',
	'Pink Food Colouring',
	'Blue Food Colouring',
	'Yellow Food Colouring'
] as const;

// Common aliases that map to TheMealDB names
const ALIASES: Record<string, string> = {
	// Plurals and variants
	eggs: 'Egg',
	chickens: 'Chicken',
	salmons: 'Salmon',
	beefs: 'Beef',
	lambs: 'Lamb',
	porks: 'Pork',
	tunas: 'Tuna',

	// American vs British English
	eggplant: 'Aubergine',
	eggplants: 'Aubergine',
	zucchinis: 'Courgettes',
	cilantros: 'Coriander',
	shrimp: 'Prawns',
	shrimps: 'Prawns',
	scallion: 'Spring Onions',
	scallions: 'Spring Onions',
	arugula: 'Rocket',
	bell: 'Red Pepper',

	// Common shortcuts
	evoo: 'Extra Virgin Olive Oil',
	parm: 'Parmesan',
	parmigiano: 'Parmesan',
	mozz: 'Mozzarella',
	'soy sauce': 'Soy Sauce',
	'fish sauce': 'Fish Sauce',
	'olive oil': 'Olive Oil',
	'vegetable oil': 'Vegetable Oil',
	'sesame oil': 'Sesame Seed Oil',

	// Measurement-related
	clove: 'Garlic Clove',
	cloves: 'Garlic Clove',
	breast: 'Chicken Breast',
	breasts: 'Chicken Breast',
	thigh: 'Chicken Thighs',
	thighs: 'Chicken Thighs',
	leg: 'Chicken Legs',
	legs: 'Chicken Legs',

	// Common preparations
	minced: 'Minced Beef',
	ground: 'Minced Beef',

	// Common misspellings
	tomatoe: 'Tomato',
	potatoe: 'Potato',
	tumeric: 'Turmeric',
	cinamon: 'Cinnamon',
	parsely: 'Parsley',
	brocoli: 'Broccoli',
	brocolli: 'Broccoli',
	califlower: 'Cauliflower',
	avacado: 'Avocado',
	advacado: 'Avocado'
};

// Initialize Fuse for fuzzy matching
const fuse = new Fuse(THEMEALDB_INGREDIENTS as unknown as string[], {
	threshold: 0.35, // Lower = stricter matching
	distance: 100,
	minMatchCharLength: 2,
	includeScore: true
});

/**
 * Get the TheMealDB image URL for an ingredient
 * Uses fuzzy matching to find the best match
 */
export function getIngredientImageUrl(name: string): string {
	// 1. Clean input: remove text after comma or parenthesis
	const cleaned = name.split(/[,(]/)[0].trim().toLowerCase();

	// 2. Check direct alias match first (most common cases)
	const aliasMatch = ALIASES[cleaned];
	if (aliasMatch) {
		return buildImageUrl(aliasMatch);
	}

	// 3. Split into words and try to find matches
	const words = cleaned.split(/\s+/);

	// 4. Try multi-word combinations (e.g., "olive oil", "soy sauce")
	if (words.length >= 2) {
		const twoWordPhrase = words.slice(-2).join(' ');
		const aliasForPhrase = ALIASES[twoWordPhrase];
		if (aliasForPhrase) {
			return buildImageUrl(aliasForPhrase);
		}
	}

	// 5. Try fuzzy matching on each word (from last to first, as last word is often the ingredient)
	for (let i = words.length - 1; i >= 0; i--) {
		const word = words[i];
		if (!word || word.length < 2) continue;

		// Check alias for single word
		const singleAlias = ALIASES[word];
		if (singleAlias) {
			return buildImageUrl(singleAlias);
		}

		// Fuzzy search
		const results = fuse.search(word);
		if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.35) {
			return buildImageUrl(results[0].item);
		}
	}

	// 6. Fallback: try the full cleaned string with fuzzy match
	const fullResults = fuse.search(cleaned);
	if (fullResults.length > 0 && fullResults[0].score !== undefined && fullResults[0].score < 0.4) {
		return buildImageUrl(fullResults[0].item);
	}

	// 7. Last resort: title-case the last word and hope for the best
	const lastWord = words[words.length - 1] ?? cleaned;
	const formatted = toTitleCase(singularize(lastWord));
	return buildImageUrl(formatted);
}

/**
 * Build TheMealDB image URL
 */
function buildImageUrl(ingredientName: string): string {
	return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(ingredientName)}-Small.png`;
}

/**
 * Convert string to Title Case
 */
function toTitleCase(str: string): string {
	return str
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
}

/**
 * Simple singularization for common patterns
 */
function singularize(word: string): string {
	if (word.endsWith('ies')) {
		return word.slice(0, -3) + 'y';
	}
	if (word.endsWith('es') && !word.endsWith('ses') && !word.endsWith('ches')) {
		return word.slice(0, -2);
	}
	if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
		return word.slice(0, -1);
	}
	return word;
}

/**
 * Check if TheMealDB likely has an image for this ingredient
 * Useful for pre-validation before rendering
 */
export function hasKnownIngredientImage(name: string): boolean {
	const cleaned = name.split(/[,(]/)[0].trim().toLowerCase();

	// Check aliases
	if (ALIASES[cleaned]) return true;

	// Check fuzzy match
	const words = cleaned.split(/\s+/);
	for (const word of words) {
		if (word.length < 2) continue;
		if (ALIASES[word]) return true;
		const results = fuse.search(word);
		if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.35) {
			return true;
		}
	}

	return false;
}
