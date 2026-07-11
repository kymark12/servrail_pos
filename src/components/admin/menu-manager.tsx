"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createItem,
  updateItem,
  setItemActive,
  deleteItem,
  type ActionResult,
} from "@/app/(admin)/menu/actions";

export type ItemDTO = {
  id: string;
  categoryId: string;
  name: string;
  price: string;
  isActive: boolean;
};
export type CategoryDTO = {
  id: string;
  name: string;
  sortOrder: number;
  items: ItemDTO[];
};

export function MenuManager({
  categories,
  currency,
}: {
  categories: CategoryDTO[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newCategory, setNewCategory] = useState("");

  function run(fn: () => Promise<ActionResult>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  function addCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    run(() => createCategory({ name }), "Category added");
    setNewCategory("");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addCategory} className="flex gap-2">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Coffee, Pastries"
              maxLength={80}
            />
            <Button type="submit" disabled={pending || !newCategory.trim()}>
              <Plus className="size-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories yet. Add one above to start building the menu.
        </p>
      ) : (
        categories.map((category) => (
          <CategoryBlock
            key={category.id}
            category={category}
            currency={currency}
            pending={pending}
            run={run}
          />
        ))
      )}
    </div>
  );
}

function CategoryBlock({
  category,
  currency,
  pending,
  run,
}: {
  category: CategoryDTO;
  currency: string;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, okMsg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        {editing ? (
          <div className="flex flex-1 gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Button
              size="sm"
              disabled={pending || !name.trim()}
              onClick={() => {
                run(() => updateCategory({ id: category.id, name: name.trim() }), "Category renamed");
                setEditing(false);
              }}
            >
              <Check className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(category.name);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <CardTitle className="text-base">
              {category.name}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({category.items.length})
              </span>
            </CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (
                    confirm(
                      `Delete "${category.name}" and its ${category.items.length} item(s)? This can't be undone.`,
                    )
                  ) {
                    run(() => deleteCategory(category.id), "Category deleted");
                  }
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {category.items.map((item) => (
          <ItemRow key={item.id} item={item} currency={currency} pending={pending} run={run} />
        ))}
        <AddItemForm categoryId={category.id} pending={pending} run={run} />
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  currency,
  pending,
  run,
}: {
  item: ItemDTO;
  currency: string;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, okMsg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" maxLength={120} />
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          className="w-28"
        />
        <Button
          size="sm"
          disabled={pending || !name.trim()}
          onClick={() => {
            run(
              () => updateItem({ id: item.id, categoryId: item.categoryId, name: name.trim(), price }),
              "Item saved",
            );
            setEditing(false);
          }}
        >
          <Check className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setName(item.name);
            setPrice(item.price);
            setEditing(false);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-2">
      <span className="flex-1 text-sm">
        {item.name}
        {!item.isActive && (
          <Badge variant="secondary" className="ml-2">
            Hidden
          </Badge>
        )}
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {currency} {item.price}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(() => setItemActive(item.id, !item.isActive), item.isActive ? "Item hidden" : "Item shown")
        }
      >
        {item.isActive ? "Hide" : "Show"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        <Pencil className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete "${item.name}"?`)) run(() => deleteItem(item.id), "Item deleted");
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}

function AddItemForm({
  categoryId,
  pending,
  run,
}: {
  categoryId: string;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, okMsg: string) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || price === "") return;
    run(() => createItem({ categoryId, name: name.trim(), price }), "Item added");
    setName("");
    setPrice("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 pt-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New item name"
        className="flex-1"
        maxLength={120}
      />
      <Input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="0.00"
        type="number"
        step="0.01"
        min="0"
        className="w-28"
      />
      <Button type="submit" variant="outline" disabled={pending || !name.trim() || price === ""}>
        <Plus className="size-4" /> Item
      </Button>
    </form>
  );
}
