import bcrypt from "bcryptjs";
import { db, setSession } from "./db";
import type { PosSession } from "./types";

/**
 * Verify an entered PIN against the locally-cached staff hashes and clock that
 * cashier in. Runs entirely in the browser, so it works fully offline — provided
 * the device has loaded the till online at least once to cache the staff.
 * Returns the matched session, or null if no cached hash matches.
 */
export async function verifyPin(pin: string): Promise<PosSession | null> {
  if (!/^\d{4,6}$/.test(pin)) return null;
  const creds = await db().staff.toArray();
  for (const c of creds) {
    if (await bcrypt.compare(pin, c.pinHash)) {
      const session: PosSession = {
        staffId: c.id,
        staffName: c.name,
        role: c.role,
        businessId: c.businessId,
      };
      await setSession(session);
      return session;
    }
  }
  return null;
}
