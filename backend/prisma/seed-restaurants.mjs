import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

const empty = { aminoAcids: {}, fattyAcids: {}, vitamins: {}, minerals: {} };

const restaurants = [
  // ── McDonald's ──────────────────────────────────────────────────────────────
  {
    name: "Big Mac", brand: "McDonald's", category: "Restaurants",
    servingSize: 219, servingUnit: 'g',
    calories: 550, protein: 25, carbs: 46, fat: 30, fiber: 3, sugar: 9, sodium: 1010,
    ...empty,
  },
  {
    name: "McChicken", brand: "McDonald's", category: "Restaurants",
    servingSize: 161, servingUnit: 'g',
    calories: 400, protein: 14, carbs: 40, fat: 22, fiber: 2, sugar: 5, sodium: 560,
    ...empty,
  },
  {
    name: "Filet-O-Fish", brand: "McDonald's", category: "Restaurants",
    servingSize: 142, servingUnit: 'g',
    calories: 380, protein: 15, carbs: 39, fat: 18, fiber: 1, sugar: 6, sodium: 580,
    ...empty,
  },
  {
    name: "Large Fries", brand: "McDonald's", category: "Restaurants",
    servingSize: 178, servingUnit: 'g',
    calories: 490, protein: 7, carbs: 66, fat: 23, fiber: 6, sugar: 0, sodium: 400,
    ...empty,
  },
  {
    name: "Egg McMuffin", brand: "McDonald's", category: "Restaurants",
    servingSize: 135, servingUnit: 'g',
    calories: 310, protein: 17, carbs: 30, fat: 13, fiber: 2, sugar: 3, sodium: 770,
    ...empty,
  },
  {
    name: "Caesar Salad", brand: "McDonald's", category: "Restaurants",
    servingSize: 228, servingUnit: 'g',
    calories: 90, protein: 7, carbs: 9, fat: 4, fiber: 2, sugar: 4, sodium: 180,
    ...empty,
  },
  {
    name: "Fruit & Maple Oatmeal", brand: "McDonald's", category: "Restaurants",
    servingSize: 349, servingUnit: 'g',
    calories: 320, protein: 6, carbs: 64, fat: 5, fiber: 5, sugar: 32, sodium: 150,
    ...empty,
  },
  {
    name: "Apple Pie", brand: "McDonald's", category: "Restaurants",
    servingSize: 84, servingUnit: 'g',
    calories: 240, protein: 2, carbs: 35, fat: 11, fiber: 1, sugar: 13, sodium: 180,
    ...empty,
  },

  // ── Chipotle ────────────────────────────────────────────────────────────────
  {
    name: "Chicken Burrito Bowl", brand: "Chipotle", category: "Restaurants",
    servingSize: 500, servingUnit: 'g',
    calories: 665, protein: 56, carbs: 50, fat: 23, fiber: 14, sugar: 4, sodium: 1450,
    ...empty,
  },
  {
    name: "Steak Burrito", brand: "Chipotle", category: "Restaurants",
    servingSize: 600, servingUnit: 'g',
    calories: 750, protein: 50, carbs: 81, fat: 27, fiber: 9, sugar: 5, sodium: 1710,
    ...empty,
  },
  {
    name: "Sofritas Bowl", brand: "Chipotle", category: "Restaurants",
    servingSize: 490, servingUnit: 'g',
    calories: 555, protein: 22, carbs: 62, fat: 18, fiber: 14, sugar: 6, sodium: 1320,
    ...empty,
  },
  {
    name: "Chips and Guacamole", brand: "Chipotle", category: "Restaurants",
    servingSize: 283, servingUnit: 'g',
    calories: 770, protein: 10, carbs: 85, fat: 46, fiber: 12, sugar: 2, sodium: 630,
    ...empty,
  },
  {
    name: "Chicken Salad", brand: "Chipotle", category: "Restaurants",
    servingSize: 380, servingUnit: 'g',
    calories: 330, protein: 37, carbs: 20, fat: 10, fiber: 8, sugar: 4, sodium: 940,
    ...empty,
  },
  {
    name: "Carnitas Tacos", brand: "Chipotle", category: "Restaurants",
    servingSize: 330, servingUnit: 'g',
    calories: 450, protein: 27, carbs: 54, fat: 14, fiber: 6, sugar: 3, sodium: 1230,
    ...empty,
  },
  {
    name: "Veggie Bowl", brand: "Chipotle", category: "Restaurants",
    servingSize: 455, servingUnit: 'g',
    calories: 475, protein: 15, carbs: 60, fat: 16, fiber: 12, sugar: 5, sodium: 1100,
    ...empty,
  },

  // ── Subway ──────────────────────────────────────────────────────────────────
  {
    name: '6" Turkey Breast Sub', brand: "Subway", category: "Restaurants",
    servingSize: 235, servingUnit: 'g',
    calories: 280, protein: 18, carbs: 47, fat: 4, fiber: 2, sugar: 6, sodium: 780,
    ...empty,
  },
  {
    name: 'Footlong Tuna Sub', brand: "Subway", category: "Restaurants",
    servingSize: 470, servingUnit: 'g',
    calories: 730, protein: 37, carbs: 74, fat: 35, fiber: 5, sugar: 14, sodium: 910,
    ...empty,
  },
  {
    name: '6" Veggie Delite', brand: "Subway", category: "Restaurants",
    servingSize: 210, servingUnit: 'g',
    calories: 230, protein: 9, carbs: 44, fat: 3, fiber: 4, sugar: 7, sodium: 490,
    ...empty,
  },
  {
    name: '6" Chicken Teriyaki', brand: "Subway", category: "Restaurants",
    servingSize: 280, servingUnit: 'g',
    calories: 370, protein: 26, carbs: 59, fat: 5, fiber: 4, sugar: 13, sodium: 1010,
    ...empty,
  },
  {
    name: '6" Meatball Marinara', brand: "Subway", category: "Restaurants",
    servingSize: 308, servingUnit: 'g',
    calories: 480, protein: 23, carbs: 61, fat: 15, fiber: 4, sugar: 14, sodium: 1180,
    ...empty,
  },
  {
    name: '6" Steak and Cheese', brand: "Subway", category: "Restaurants",
    servingSize: 258, servingUnit: 'g',
    calories: 380, protein: 25, carbs: 47, fat: 10, fiber: 3, sugar: 7, sodium: 830,
    ...empty,
  },

  // ── Starbucks ────────────────────────────────────────────────────────────────
  {
    name: "Grande Caffe Latte", brand: "Starbucks", category: "Restaurants",
    servingSize: 473, servingUnit: 'ml',
    calories: 190, protein: 13, carbs: 19, fat: 7, fiber: 0, sugar: 18, sodium: 150,
    ...empty,
  },
  {
    name: "Grande Frappuccino", brand: "Starbucks", category: "Restaurants",
    servingSize: 473, servingUnit: 'ml',
    calories: 420, protein: 5, carbs: 66, fat: 15, fiber: 1, sugar: 63, sodium: 260,
    ...empty,
  },
  {
    name: "Grande Iced Coffee", brand: "Starbucks", category: "Restaurants",
    servingSize: 473, servingUnit: 'ml',
    calories: 80, protein: 4, carbs: 11, fat: 3, fiber: 0, sugar: 11, sodium: 30,
    ...empty,
  },
  {
    name: "Grande Oat Milk Latte", brand: "Starbucks", category: "Restaurants",
    servingSize: 473, servingUnit: 'ml',
    calories: 240, protein: 9, carbs: 32, fat: 9, fiber: 1, sugar: 22, sodium: 150,
    ...empty,
  },
  {
    name: "Bacon & Gruyere Egg Bites", brand: "Starbucks", category: "Restaurants",
    servingSize: 110, servingUnit: 'g',
    calories: 310, protein: 22, carbs: 9, fat: 21, fiber: 0, sugar: 2, sodium: 680,
    ...empty,
  },
  {
    name: "Blueberry Muffin", brand: "Starbucks", category: "Restaurants",
    servingSize: 130, servingUnit: 'g',
    calories: 380, protein: 5, carbs: 60, fat: 14, fiber: 1, sugar: 32, sodium: 380,
    ...empty,
  },
  {
    name: "Banana Bread", brand: "Starbucks", category: "Restaurants",
    servingSize: 115, servingUnit: 'g',
    calories: 420, protein: 6, carbs: 68, fat: 15, fiber: 2, sugar: 36, sodium: 320,
    ...empty,
  },

  // ── Chick-fil-A ──────────────────────────────────────────────────────────────
  {
    name: "Original Chicken Sandwich", brand: "Chick-fil-A", category: "Restaurants",
    servingSize: 196, servingUnit: 'g',
    calories: 470, protein: 28, carbs: 39, fat: 21, fiber: 1, sugar: 5, sodium: 1400,
    ...empty,
  },
  {
    name: "Grilled Chicken Sandwich", brand: "Chick-fil-A", category: "Restaurants",
    servingSize: 196, servingUnit: 'g',
    calories: 320, protein: 29, carbs: 36, fat: 7, fiber: 2, sugar: 7, sodium: 820,
    ...empty,
  },
  {
    name: "Nuggets 8-Piece", brand: "Chick-fil-A", category: "Restaurants",
    servingSize: 113, servingUnit: 'g',
    calories: 260, protein: 27, carbs: 12, fat: 12, fiber: 0, sugar: 1, sodium: 1060,
    ...empty,
  },
  {
    name: "Waffle Fries Medium", brand: "Chick-fil-A", category: "Restaurants",
    servingSize: 125, servingUnit: 'g',
    calories: 420, protein: 5, carbs: 52, fat: 21, fiber: 4, sugar: 1, sodium: 270,
    ...empty,
  },
  {
    name: "Cobb Salad", brand: "Chick-fil-A", category: "Restaurants",
    servingSize: 360, servingUnit: 'g',
    calories: 320, protein: 40, carbs: 15, fat: 11, fiber: 4, sugar: 6, sodium: 950,
    ...empty,
  },
  {
    name: "Grilled Chicken Wrap", brand: "Chick-fil-A", category: "Restaurants",
    servingSize: 254, servingUnit: 'g',
    calories: 410, protein: 37, carbs: 31, fat: 15, fiber: 2, sugar: 4, sodium: 1030,
    ...empty,
  },

  // ── Panera Bread ─────────────────────────────────────────────────────────────
  {
    name: "Broccoli Cheddar Soup", brand: "Panera Bread", category: "Restaurants",
    servingSize: 454, servingUnit: 'g',
    calories: 370, protein: 17, carbs: 30, fat: 22, fiber: 4, sugar: 8, sodium: 1360,
    ...empty,
  },
  {
    name: "Turkey Sandwich", brand: "Panera Bread", category: "Restaurants",
    servingSize: 310, servingUnit: 'g',
    calories: 550, protein: 31, carbs: 72, fat: 14, fiber: 3, sugar: 10, sodium: 1390,
    ...empty,
  },
  {
    name: "Classic Caesar Salad", brand: "Panera Bread", category: "Restaurants",
    servingSize: 350, servingUnit: 'g',
    calories: 390, protein: 14, carbs: 18, fat: 31, fiber: 3, sugar: 3, sodium: 730,
    ...empty,
  },
  {
    name: "Plain Bagel", brand: "Panera Bread", category: "Restaurants",
    servingSize: 128, servingUnit: 'g',
    calories: 290, protein: 11, carbs: 58, fat: 2, fiber: 2, sugar: 6, sodium: 570,
    ...empty,
  },
  {
    name: "Mac and Cheese Bowl", brand: "Panera Bread", category: "Restaurants",
    servingSize: 454, servingUnit: 'g',
    calories: 840, protein: 35, carbs: 91, fat: 38, fiber: 3, sugar: 10, sodium: 1680,
    ...empty,
  },
  {
    name: "Avocado Chicken Bowl", brand: "Panera Bread", category: "Restaurants",
    servingSize: 420, servingUnit: 'g',
    calories: 590, protein: 40, carbs: 44, fat: 25, fiber: 8, sugar: 6, sodium: 940,
    ...empty,
  },

  // ── Taco Bell ────────────────────────────────────────────────────────────────
  {
    name: "Crunchy Taco", brand: "Taco Bell", category: "Restaurants",
    servingSize: 78, servingUnit: 'g',
    calories: 170, protein: 8, carbs: 13, fat: 9, fiber: 2, sugar: 1, sodium: 310,
    ...empty,
  },
  {
    name: "Burrito Supreme", brand: "Taco Bell", category: "Restaurants",
    servingSize: 248, servingUnit: 'g',
    calories: 400, protein: 17, carbs: 51, fat: 14, fiber: 7, sugar: 4, sodium: 1060,
    ...empty,
  },
  {
    name: "Nachos BellGrande", brand: "Taco Bell", category: "Restaurants",
    servingSize: 308, servingUnit: 'g',
    calories: 770, protein: 19, carbs: 80, fat: 42, fiber: 10, sugar: 4, sodium: 1230,
    ...empty,
  },
  {
    name: "Bean Burrito", brand: "Taco Bell", category: "Restaurants",
    servingSize: 198, servingUnit: 'g',
    calories: 350, protein: 14, carbs: 56, fat: 8, fiber: 8, sugar: 3, sodium: 1130,
    ...empty,
  },
  {
    name: "Cheesy Gordita Crunch", brand: "Taco Bell", category: "Restaurants",
    servingSize: 181, servingUnit: 'g',
    calories: 500, protein: 20, carbs: 43, fat: 29, fiber: 4, sugar: 5, sodium: 810,
    ...empty,
  },

  // ── Pizza Hut ────────────────────────────────────────────────────────────────
  {
    name: "Pepperoni Pizza Slice", brand: "Pizza Hut", category: "Restaurants",
    servingSize: 95, servingUnit: 'g',
    calories: 290, protein: 13, carbs: 32, fat: 12, fiber: 2, sugar: 3, sodium: 700,
    ...empty,
  },
  {
    name: "Cheese Pizza Slice", brand: "Pizza Hut", category: "Restaurants",
    servingSize: 90, servingUnit: 'g',
    calories: 250, protein: 11, carbs: 32, fat: 9, fiber: 2, sugar: 3, sodium: 620,
    ...empty,
  },
  {
    name: "Veggie Pizza Slice", brand: "Pizza Hut", category: "Restaurants",
    servingSize: 95, servingUnit: 'g',
    calories: 260, protein: 10, carbs: 34, fat: 10, fiber: 2, sugar: 4, sodium: 550,
    ...empty,
  },
  {
    name: "Breadstick", brand: "Pizza Hut", category: "Restaurants",
    servingSize: 52, servingUnit: 'g',
    calories: 140, protein: 4, carbs: 26, fat: 2, fiber: 1, sugar: 2, sodium: 370,
    ...empty,
  },
];

async function main() {
  const existing = await prisma.food.findFirst({ where: { category: 'Restaurants' } });
  if (existing) {
    console.log('Restaurant foods already seeded — skipping. Delete them first to re-seed.');
    return;
  }

  const result = await prisma.food.createMany({
    data: restaurants.map((f) => ({
      ...f,
      aminoAcids: JSON.stringify(f.aminoAcids),
      fattyAcids: JSON.stringify(f.fattyAcids),
      vitamins:   JSON.stringify(f.vitamins),
      minerals:   JSON.stringify(f.minerals),
    })),
  });

  console.log(`Seeded ${result.count} restaurant menu items across 8 restaurants.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
