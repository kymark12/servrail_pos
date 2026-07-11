/**
 * Demo seed: a realistic café menu for the active business, so the admin UI (and
 * later the till) has something presentable. Idempotent — clears this business's
 * existing menu categories (items cascade) before inserting the sample set.
 *
 * Run from pos-prototype/:  npx tsx prisma/seed-demo.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

const MENU: { name: string; items: [string, number][] }[] = [
  {
    name: "Coffee",
    items: [
      ["Americano", 100],
      ["Café Latte", 130],
      ["Cappuccino", 130],
      ["Spanish Latte", 150],
      ["Caramel Macchiato", 160],
    ],
  },
  {
    name: "Milk Tea",
    items: [
      ["Classic Milk Tea", 120],
      ["Wintermelon", 130],
      ["Taro", 140],
      ["Okinawa", 140],
    ],
  },
  {
    name: "Rice Meals",
    items: [
      ["Tapsilog", 95],
      ["Longsilog", 90],
      ["Chicken Adobo Rice", 120],
      ["Pork Sisig Rice", 130],
    ],
  },
  {
    name: "Snacks",
    items: [
      ["Fries", 60],
      ["Cheese Sticks (5pcs)", 75],
      ["Lumpiang Shanghai (3pcs)", 50],
      ["Clubhouse Sandwich", 110],
    ],
  },
  {
    name: "Cold Drinks",
    items: [
      ["House Iced Tea", 45],
      ["Bottled Water", 25],
      ["Soft Drinks", 45],
    ],
  },
];

async function main() {
  const business = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) throw new Error("No business found to seed.");
  console.log(`→ Seeding demo menu for "${business.name}" (${business.id})`);

  // Clean slate for this business's menu (items cascade with their category).
  await prisma.menuCategory.deleteMany({ where: { businessId: business.id } });

  let categoryCount = 0;
  let itemCount = 0;
  for (const [index, cat] of MENU.entries()) {
    await prisma.menuCategory.create({
      data: {
        businessId: business.id,
        name: cat.name,
        sortOrder: index,
        items: {
          create: cat.items.map(([name, price]) => ({
            businessId: business.id,
            name,
            price: price.toFixed(2),
          })),
        },
      },
    });
    categoryCount += 1;
    itemCount += cat.items.length;
  }

  console.log(`✓ Seeded ${categoryCount} categories, ${itemCount} items.`);
}

main()
  .catch((e) => {
    console.error("✗ seed-demo failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
