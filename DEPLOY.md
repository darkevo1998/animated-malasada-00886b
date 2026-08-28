# Deploy guide (static site)

This project is plain HTML/CSS/JS — **no build step**.

## Fastest deploy: Netlify Drop (recommended)

1. Open **[https://app.netlify.com/drop](https://app.netlify.com/drop)** (free account if prompted).
2. Drag the entire **`deploy/`** folder onto the page.
3. Netlify gives you a live HTTPS URL like `https://random-name.netlify.app`.
4. Optional: Site settings → Domain management → change subdomain to e.g. `sushi-klassiek.netlify.app`.

The `deploy/` folder is rebuilt after changes and contains only:

```
deploy/
  index.html
  css/styles.css
  js/app.js
  js/menu-data.js
```

## Rebuild deploy folder after edits

From the project root:

```powershell
Remove-Item deploy -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory deploy\css, deploy\js -Force | Out-Null
Copy-Item index.html deploy\
Copy-Item css\styles.css deploy\css\
Copy-Item js\app.js, js\menu-data.js deploy\js\
```

## Other free hosts

| Host | Notes |
|------|-------|
| [Cloudflare Pages](https://pages.cloudflare.com/) | Fast CDN, connect GitHub or upload |
| [Vercel](https://vercel.com/) | `npx vercel deploy deploy --prod` |
| [Surge.sh](https://surge.sh/) | `npx surge deploy/` |

## Images

Dish photos hotlink from `cdn.sitedish.nl` (same as [sushiklassiek.nl](https://www.sushiklassiek.nl/)). To refresh URLs after menu changes:

```bash
node scripts/fetch-images.cjs
```

Then rebuild `deploy/` as above.

## Custom domain

Add your domain in the host dashboard; free SSL is automatic.
