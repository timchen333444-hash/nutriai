/**
 * One-shot repair: finds Food rows where calories = 0 but macros indicate real
 * energy content, then back-fills calories using the Atwater formula:
 *   calories = (protein * 4) + (carbs * 4) + (fat * 9)
 *
 * Run with:  node prisma/fix-zero-calories.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const broken = await prisma.food.findMany({
    where: {
      calories: { lte: 0 },
      OR: [
        { protein: { gt: 0 } },
        { fat:     { gt: 0 } },
        { carbs:   { gt: 0 } },
      ],
    },
  });

  if (broken.length === 0) {
    console.log('No broken food entries found — nothing to fix.');
    return;
  }

  console.log(`Found ${broken.length} food(s) with 0 calories but non-zero macros:`);

  let updated = 0;
  for (const food of broken) {
    const estimated = Math.round((food.protein * 4 + food.carbs * 4 + food.fat * 9) * 10) / 10;
    if (estimated <= 0) {
      console.log(`  SKIP  [${food.id}] ${food.name} — all macros are 0, cannot estimate`);
      continue;
    }

    await prisma.food.update({
      where: { id: food.id },
      data:  { calories: estimated },
    });

    console.log(`  FIXED [${food.id}] ${food.name}: 0 → ${estimated} kcal  (P${food.protein}g C${food.carbs}g F${food.fat}g)`);
    updated++;
  }

  console.log(`\nDone — updated ${updated}/${broken.length} entries.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
