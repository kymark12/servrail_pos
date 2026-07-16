// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPin } from "./auth";
import { cacheStaff, db, getSession } from "./db";
import type { StaffCredential } from "./types";

const BUSINESS = "biz_1";

function staff(over: Partial<StaffCredential> & { pin: string }): StaffCredential {
  const { pin, ...rest } = over;
  return {
    id: "staff_1",
    businessId: BUSINESS,
    name: "Alice",
    role: "CASHIER",
    pinHash: bcrypt.hashSync(pin, 8),
    ...rest,
  };
}

beforeEach(async () => {
  await db().staff.clear();
  await db().session.clear();
});

describe("verifyPin", () => {
  it("clocks in the matching cashier and persists the session", async () => {
    await cacheStaff(BUSINESS, [staff({ pin: "1234" })]);

    const session = await verifyPin("1234");

    expect(session).toEqual({
      staffId: "staff_1",
      staffName: "Alice",
      role: "CASHIER",
      businessId: BUSINESS,
    });
    // The session store is written so the rest of the till knows who's on shift.
    expect(await getSession()).toEqual(session);
  });

  it("returns null and clocks nobody in on a wrong PIN", async () => {
    await cacheStaff(BUSINESS, [staff({ pin: "1234" })]);

    expect(await verifyPin("9999")).toBeNull();
    expect(await getSession()).toBeNull();
  });

  it("rejects a malformed PIN without touching the cache", async () => {
    await cacheStaff(BUSINESS, [staff({ pin: "1234" })]);

    expect(await verifyPin("12")).toBeNull(); // too short
    expect(await verifyPin("abcd")).toBeNull(); // not digits
  });

  it("matches the right cashier among several", async () => {
    await cacheStaff(BUSINESS, [
      staff({ id: "staff_1", name: "Alice", pin: "1111" }),
      staff({ id: "staff_2", name: "Bob", role: "MANAGER", pin: "2222" }),
    ]);

    const session = await verifyPin("2222");
    expect(session?.staffId).toBe("staff_2");
    expect(session?.role).toBe("MANAGER");
  });
});
