"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createStaff,
  updateStaff,
  setStaffActive,
  deleteStaff,
  type ActionResult,
} from "@/app/(admin)/staff/actions";

type Role = "CASHIER" | "MANAGER";
export type StaffDTO = { id: string; name: string; role: Role; isActive: boolean };

const ROLES: Role[] = ["CASHIER", "MANAGER"];

function RoleSelect({
  value,
  onChange,
}: {
  value: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r === "CASHIER" ? "Cashier" : "Manager"}
        </option>
      ))}
    </select>
  );
}

export function StaffManager({ staff }: { staff: StaffDTO[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionResult>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        router.refresh(); // deleteStaff may have deactivated — reflect it
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <AddStaffForm pending={pending} run={run} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff yet. Add one above.</p>
          ) : (
            staff.map((s) => (
              <StaffRow key={s.id} staff={s} pending={pending} run={run} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddStaffForm({
  pending,
  run,
}: {
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, okMsg: string) => void;
}) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !/^\d{4,6}$/.test(pin)) return;
    run(() => createStaff({ name: name.trim(), pin, role }), "Staff added");
    setName("");
    setPin("");
    setRole("CASHIER");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add staff</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="staff-name">Name</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="staff-pin">PIN (4–6 digits)</Label>
            <Input
              id="staff-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              className="w-32"
              placeholder="••••"
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <div>
              <RoleSelect value={role} onChange={setRole} />
            </div>
          </div>
          <Button type="submit" disabled={pending || !name.trim() || !/^\d{4,6}$/.test(pin)}>
            <Plus className="size-4" /> Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StaffRow({
  staff,
  pending,
  run,
}: {
  staff: StaffDTO;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>, okMsg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(staff.name);
  const [role, setRole] = useState<Role>(staff.role);
  const [pin, setPin] = useState("");

  if (editing) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="w-44" />
        </div>
        <div className="space-y-1">
          <Label>New PIN (optional)</Label>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="leave blank to keep"
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label>Role</Label>
          <div>
            <RoleSelect value={role} onChange={setRole} />
          </div>
        </div>
        <Button
          size="sm"
          disabled={pending || !name.trim() || (pin !== "" && !/^\d{4,6}$/.test(pin))}
          onClick={() => {
            run(
              () => updateStaff({ id: staff.id, name: name.trim(), role, pin }),
              "Staff saved",
            );
            setEditing(false);
            setPin("");
          }}
        >
          <Check className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setName(staff.name);
            setRole(staff.role);
            setPin("");
            setEditing(false);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <span className="flex-1 font-medium">
        {staff.name}
        {!staff.isActive && (
          <Badge variant="secondary" className="ml-2">
            Inactive
          </Badge>
        )}
      </span>
      <Badge variant={staff.role === "MANAGER" ? "default" : "outline"}>
        {staff.role === "MANAGER" ? "Manager" : "Cashier"}
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(() => setStaffActive(staff.id, !staff.isActive), staff.isActive ? "Deactivated" : "Reactivated")
        }
      >
        {staff.isActive ? "Deactivate" : "Reactivate"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
        <Pencil className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete ${staff.name}?`)) run(() => deleteStaff(staff.id), "Staff deleted");
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  );
}
