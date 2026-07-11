# Running the POS demo locally + serving it over Tailscale

Run the app in Docker on your Mac, then expose it over your tailnet so your
Fold phone and iPad can reach it — no Vercel deploy needed.

## Prerequisites
- **Docker Desktop** running on the Mac.
- **`.env`** present in `pos-prototype/` with the persistent Neon demo-branch
  `DATABASE_URL` / `DIRECT_URL`, plus `AUTH_SECRET` and `AUTH_TRUST_HOST=true`.
  (Gitignored — it is not in the repo.)
- **Tailscale** installed and logged in on the Mac **and** on each phone/iPad,
  all on the **same tailnet**.

## 1. Run it in Docker
```bash
cd pos-prototype
docker compose up --build
```
First build takes a few minutes (installs deps + builds). When it's up, open
<http://localhost:3000> on the Mac to confirm. Stop with `Ctrl+C`, or run
detached with `docker compose up --build -d` (logs: `docker compose logs -f`).

> Port 3000 in use? Change the left side of the mapping in `docker-compose.yml`
> (e.g. `"8080:3000"`) and use that port everywhere below.

## 2. Serve it over Tailscale (HTTPS)
Use **Tailscale Serve** — it fronts the app with a real HTTPS cert on your
machine's MagicDNS name. HTTPS matters: in production mode the login uses secure
cookies, which won't stick over plain `http://<ip>:3000`.

One-time: in the [Tailscale admin console](https://login.tailscale.com/admin/dns),
enable **MagicDNS** and **HTTPS Certificates**.

```bash
# Proxy the tailnet HTTPS endpoint to the local app:
tailscale serve --bg 3000

# See the public-to-your-tailnet URL:
tailscale serve status
```
That prints something like `https://your-mac.your-tailnet.ts.net`.

Stop serving later with: `tailscale serve reset`.

## 3. Open it on the Fold and the iPad
1. Open the **Tailscale app** on the device and make sure it's connected to the
   same tailnet.
2. Open the `https://….ts.net` URL:
   - **Fold 4** → **Chrome** (this is also the WebUSB-capable device for the
     future printer phase).
   - **iPad** → **Safari**. The tablet width shows the two-column till (menu +
     cart sidebar) — the ideal POS layout.
3. Sign in with the owner login, tap **Open till →**, and enter a cashier PIN.
   Credentials are in `DEMO_CREDENTIALS.md`.

Tip: on either device, use the browser's **Add to Home Screen** for an app-like,
full-screen launch during the demo.

## iPad — what works and what doesn't
- **Works now:** the entire demo — browsing the menu, cart, cash checkout, and
  the on-screen receipt. Responsive layout suits the iPad well.
- **Won't work on iPad (later):** the Phase 5 **thermal printer uses WebUSB**,
  which **iOS/iPadOS Safari does not support**. Physical receipt printing will
  need the **Android Fold (Chrome)**. So: iPad = great ordering/display surface;
  Android = the device that can drive the printer.

## Stopping everything
```bash
docker compose down        # stop the app
tailscale serve reset      # stop exposing it
```
