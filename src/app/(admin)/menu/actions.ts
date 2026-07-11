"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePosEntitlement } from "@/lib/entitlement";

// Every action re-runs the entitlement gate and scopes writes to the resolved
// business — never trusting a businessId from the client.

export type ActionResult = { ok: true } | { ok: false; error: string };

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function createCategory(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await prisma.menuCategory.create({
    data: { businessId: business.id, name: parsed.data.name, sortOrder: parsed.data.sortOrder },
  });
  revalidatePath("/menu");
  return { ok: true };
}

export async function updateCategory(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const schema = categorySchema.extend({ id: z.string().min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Scope: only update rows belonging to this business.
  const result = await prisma.menuCategory.updateMany({
    where: { id: parsed.data.id, businessId: business.id },
    data: { name: parsed.data.name, sortOrder: parsed.data.sortOrder },
  });
  if (result.count === 0) return { ok: false, error: "Category not found" };
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  // Deleting a category cascades to its items (FK ON DELETE CASCADE).
  const result = await prisma.menuCategory.deleteMany({
    where: { id, businessId: business.id },
  });
  if (result.count === 0) return { ok: false, error: "Category not found" };
  revalidatePath("/menu");
  return { ok: true };
}

const itemSchema = z.object({
  categoryId: z.string().min(1, "Pick a category"),
  name: z.string().trim().min(1, "Name is required").max(120),
  price: z.coerce.number().nonnegative("Price can't be negative").max(1_000_000),
});

// Confirms the category belongs to this business before writing an item to it.
async function assertCategoryOwned(categoryId: string, businessId: string) {
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, businessId },
    select: { id: true },
  });
  return category !== null;
}

export async function createItem(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (!(await assertCategoryOwned(parsed.data.categoryId, business.id))) {
    return { ok: false, error: "Category not found" };
  }

  await prisma.menuItem.create({
    data: {
      businessId: business.id,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price.toFixed(2),
    },
  });
  revalidatePath("/menu");
  return { ok: true };
}

export async function updateItem(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const schema = itemSchema.extend({ id: z.string().min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (!(await assertCategoryOwned(parsed.data.categoryId, business.id))) {
    return { ok: false, error: "Category not found" };
  }

  const result = await prisma.menuItem.updateMany({
    where: { id: parsed.data.id, businessId: business.id },
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price.toFixed(2),
    },
  });
  if (result.count === 0) return { ok: false, error: "Item not found" };
  revalidatePath("/menu");
  return { ok: true };
}

export async function setItemActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const result = await prisma.menuItem.updateMany({
    where: { id, businessId: business.id },
    data: { isActive },
  });
  if (result.count === 0) return { ok: false, error: "Item not found" };
  revalidatePath("/menu");
  return { ok: true };
}

export async function deleteItem(id: string): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const result = await prisma.menuItem.deleteMany({
    where: { id, businessId: business.id },
  });
  if (result.count === 0) return { ok: false, error: "Item not found" };
  revalidatePath("/menu");
  return { ok: true };
}
