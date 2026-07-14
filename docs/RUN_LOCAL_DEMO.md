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
machine's MagicDNS name. Don't skip this and use the raw `http://100.x.x.x:3000`
address: HTTPS is what makes the page a **secure context**, and without one,
service workers refuse to register (so no PWA / offline) and the login's secure
cookies won't stick.

One-time: in the [Tailscale admin console](https://login.tailscale.com/admin/dns),
enable **MagicDNS** and **HTTPS Certificates**.

```bash
# Proxy the tailnet HTTPS endpoint to the local app:
tailscale serve --bg --https=443 http://127.0.0.1:3000

# See the URL (tailnet-only — NOT the public internet):
tailscale serve status
```
That prints something like `https://your-mac.your-tailnet.ts.net`. Stop it later with
`tailscale serve reset`.

> **The serve config can drop** (seen after restarting the Tailscale client). If the
> `.ts.net` URL suddenly stops loading while `docker compose ps` shows the app up and
> `curl http://localhost:3000` works, that's this. Check `tailscale serve status` —
> if it says *No serve config*, just re-run the command above.

> **Only devices on your tailnet can reach this.** A `100.x` address and a
> `*.ts.net` Serve URL are private. To reach it from a device that *can't* install
> Tailscale you'd need `tailscale funnel`, which publishes it to the open
> internet — don't, while `DEMO_CREDENTIALS.md` is live.

### `AUTH_URL` must match the URL you actually open
next-auth v5 does **not** work out the origin from the request. With no `AUTH_URL`
it falls back to a hardcoded `http://localhost:3000` and issues **absolute**
redirects there — so on an iPad, sign-in bounces to the iPad itself and dies.
`docker-compose.yml` therefore pins `AUTH_URL`. On a different machine, override it
with your own Serve hostname:

```bash
AUTH_URL=https://your-mac.your-tailnet.ts.net docker compose up -d --build
```
Symptom that you got this wrong: you land on `/sign-in`, log in, and get thrown to a
dead `localhost` URL.

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

## 4. Install the till as a home-screen app
The app ships a web manifest (`src/app/manifest.ts`) and generated icons
(`src/app/icon.tsx`, `src/app/apple-icon.tsx`), so it installs as a full-screen app
with no browser chrome — the right look for a demo, and the groundwork for the
offline-first PWA phase.

**On iPad — you must use Safari, not Chrome.** On iPadOS only Safari can create a
real standalone web app; Chrome only makes a shortcut that reopens the browser.

1. Open the `https://….ts.net` URL in **Safari**.
2. Navigate to the page you want the icon to open — **`/pos`** for the till.
   iOS ignores the manifest's `start_url` and uses whatever page is on screen.
3. **Share → Add to Home Screen → Add.**
4. Launch it from the home screen: it opens full-screen, no address bar.

Requires the **HTTPS** Serve URL from step 2. Over plain `http://100.x.x.x:3000`
iOS will still add an icon, but you get no standalone mode and no service worker.

Because the installed app has no address bar, the till has a **Dashboard** link in
its header (and a **Back to dashboard** link on the PIN pad) — otherwise there is
no way out of `/pos`.

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
