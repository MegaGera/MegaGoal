# MegaGoal PWA and Google Play (Bubblewrap / TWA)

MegaGoal is configured as a **Progressive Web App (PWA)** so it can be wrapped with **[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)** as a **Trusted Web Activity (TWA)** and published on **Google Play**.

Production URL: **https://megagoal.megagera.com**

## What was added

| Piece | Purpose |
|--------|---------|
| `@angular/service-worker` | Registers `ngsw-worker.js` on production builds |
| `ngsw-config.json` | Caches static app shell and assets (API calls stay on the network) |
| `src/manifest.webmanifest` | Installable app metadata (`start_url`, `scope`, icons, …) |
| `src/.well-known/assetlinks.json` | Links your Android signing key to the domain (required for TWA) |
| `nginx.conf` | Serves manifest, service worker, and asset links with correct headers |

The service worker is **enabled only in production builds** (`ng build` / `build:prod`), not during `ng serve` development.

## 1. Deploy the PWA

Build and deploy as usual (Docker or your existing pipeline):

```bash
cd WebApp
npm run build:prod
```

After deploy, verify in Chrome on desktop:

1. Open **https://megagoal.megagera.com**
2. DevTools → **Application** → **Manifest** (no errors; `start_url` `/`, icons 192 + 512)
3. **Service workers** → `ngsw-worker.js` activated
4. **Lighthouse** → Progressive Web App audit (run against production)

Optional: install from Chrome menu (“Install MegaGoal” / “Add to Home screen”) to confirm standalone mode.

## 2. Digital Asset Links (before Play Store)

TWA requires `https://megagoal.megagera.com/.well-known/assetlinks.json` to list your **release** APK signing certificate.

1. Edit `src/.well-known/assetlinks.json`
2. Set `package_name` to the Android application id you choose in Bubblewrap (example placeholder: `com.megagera.megagoal`)
3. Replace `REPLACE_WITH_YOUR_RELEASE_KEY_SHA256_FINGERPRINT` with the SHA-256 of your **upload/release** keystore:

```bash
keytool -list -v -keystore your-release.keystore -alias your-alias
```

Use the **SHA256** line (colons removed or as printed — Bubblewrap docs show the format they expect).

4. Redeploy the WebApp container so the file is live
5. Test: [Google Digital Asset Links tool](https://developers.google.com/digital-asset-links/tools/generator) or:

```bash
curl https://megagoal.megagera.com/.well-known/assetlinks.json
```

## 3. Bubblewrap (Android TWA)

Install Bubblewrap CLI (Node 18+):

```bash
npm install -g @bubblewrap/cli
```

Initialize the Android project (use your live URL and manifest):

```bash
mkdir -p ../megagoal-android && cd ../megagoal-android
bubblewrap init --manifest https://megagoal.megagera.com/manifest.webmanifest
```

Follow prompts:

- **Domain**: `megagoal.megagera.com`
- **Package name**: must match `assetlinks.json` (`package_name`)
- **App name**: MegaGoal
- Use the same **signing key** you put in `assetlinks.json`

Build and run locally:

```bash
bubblewrap build
bubblewrap install   # device connected via adb
```

Validate TWA:

```bash
bubblewrap validate
```

Publish:

1. Create a **Google Play Console** app
2. Upload the AAB from `bubblewrap build`
3. Complete store listing, privacy policy, content rating
4. Ensure the live site stays on HTTPS and the service worker remains active

## 4. Updating the app

| Change type | Action |
|-------------|--------|
| Website / Angular | Deploy WebApp as today; users get updates on next visit (service worker) |
| Manifest, scope, start URL | Redeploy site; may need `bubblewrap update` and new Play release if Android metadata changes |
| Native shell only | `bubblewrap update` → rebuild AAB → new Play upload |

## 5. Troubleshooting

| Issue | Check |
|-------|--------|
| No install prompt | Production build deployed? SW registered? Lighthouse PWA section |
| TWA opens in browser bar | `assetlinks.json` fingerprint / package name mismatch |
| Login broken in TWA | Cookie / `SameSite` on `megaauth.megagera.com`; test login after install |
| Stale UI | Hard refresh; SW update — `ngsw.json` should not be cached long (nginx `no-cache`) |

## Optional improvements

- Dedicated **maskable** launcher icons (512×512 safe zone) instead of reusing the standard chrome icons
- `environment.ts` API URLs in `ngsw-config.json` **dataGroups** only if you want explicit offline/freshness rules (not required for TWA)
