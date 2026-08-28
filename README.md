# Sushi Klassiek – Ordering Website

Modern single-page sushi ordering demo built with **HTML**, **Tailwind CSS (Play CDN)**, and **vanilla JavaScript**.

Inspired by [sushiklassiek.nl](https://www.sushiklassiek.nl/) (structure & menu) with the visual style of [xanthineapeldoorn.nl](https://xanthineapeldoorn.nl/) (green brand `#4b911f`, Poppins, clean cards).

## How to run

No install or build step required.

1. Open `index.html` in a browser, **or**
2. Serve the folder with any static server, for example:

```bash
# Python
python -m http.server 5500

# Node (if you have npx)
npx serve .
```

Then visit `http://localhost:5500`.

## Project structure

```
├── index.html          # Single-page app (all sections)
├── css/styles.css      # Drawer, modal, toast, a11y extras
├── js/menu-data.js     # Restaurant info, hours, menu, reviews
├── js/app.js           # Cart, hours logic, rendering, checkout
└── README.md
```

## Features

- Full menu (15 categories) with allergen tags and real photos from sushiklassiek.nl
- Sticky category rail with scroll-spy
- Working cart with `localStorage` persistence
- Automatic **10% discount** from €20
- Delivery vs pickup (fee & minimum order)
- Checkout modal with confirmation (no real payment)
- Open/closed status that handles overnight hours (e.g. 16:00–01:00)
- Reviews, hours, delivery areas, contact map, cookie banner
- Responsive: mobile drawer + desktop sidebar

## Edit the menu

Open `js/menu-data.js` and change items in the `MENU` array:

```js
{ id: 'maki-salmon', name: 'Salmon (8 stuks)', price: 6.00,
  tags: ['Vis'], desc: '', image: 'https://…', popular: false }
```

Set `popular: true` to show a dish under **Populaire gerechten**.

Restaurant details, opening hours, delivery areas and reviews live in the same file (`RESTAURANT`, `OPENING_HOURS`, etc.).

## Brand colours

Configured in `index.html` via Tailwind CDN:

| Token | Value |
|-------|-------|
| `brand` | `#4b911f` |
| `brand-dark` | `#3d7719` |
| `brand-light` | `#f1f8ec` |

## Deploy

See **[DEPLOY.md](DEPLOY.md)** — drag the **`deploy/`** folder to [Netlify Drop](https://app.netlify.com/drop) for a free live HTTPS URL in ~30 seconds.

## Notes

- Checkout is a **demo** — it shows a confirmation only; no payment or backend.
- Dish images hotlink from `cdn.sitedish.nl` (same as the official site). Refresh with `node scripts/fetch-images.cjs`.
- Language buttons (NL/EN/DE/PT) are visual for now.
