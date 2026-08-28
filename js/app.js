/**
 * Sushi Klassiek – main application
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'sushi-klassiek-cart';
  const COOKIE_KEY = 'sushi-klassiek-cookies';

  // ——— State ———
  let cart = loadCart();
  let fulfillment = 'delivery'; // 'delivery' | 'pickup'
  let lastFocused = null;

  // ——— Helpers ———
  function euro(n) {
    return '€ ' + Number(n).toFixed(2).replace('.', ',');
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function findItem(id) {
    for (const cat of MENU) {
      const item = cat.items.find((i) => i.id === id);
      if (item) return item;
    }
    return null;
  }

  function cartCount() {
    return Object.values(cart).reduce((s, q) => s + q, 0);
  }

  function cartSubtotal() {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = findItem(id);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }

  function cartTotals() {
    const subtotal = cartSubtotal();
    const discount =
      subtotal >= RESTAURANT.discountThreshold
        ? subtotal * (RESTAURANT.discountPercent / 100)
        : 0;
    const delivery =
      fulfillment === 'delivery' && subtotal > 0 ? RESTAURANT.deliveryFee : 0;
    const total = Math.max(0, subtotal - discount + delivery);
    const minOrder =
      fulfillment === 'delivery' ? RESTAURANT.minDelivery : RESTAURANT.minPickup;
    const meetsMin = subtotal >= minOrder;
    return { subtotal, discount, delivery, total, minOrder, meetsMin };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ——— Opening hours (handles midnight crossing) ———
  function getDayHours(day) {
    return OPENING_HOURS.find((h) => h.day === day);
  }

  function isWithinWindow(mins, start, end) {
    if (start == null || end == null) return false;
    if (end > start) return mins >= start && mins < end;
    // crosses midnight: open from start to 24:00 OR 0:00 to end
    return mins >= start || mins < end;
  }

  function getOpenStatus(date = new Date()) {
    const day = date.getDay();
    const mins = date.getHours() * 60 + date.getMinutes();
    const today = getDayHours(day);
    const yesterday = getDayHours((day + 6) % 7);

    // Still in yesterday's overnight window?
    if (
      yesterday &&
      !yesterday.closed &&
      yesterday.end < yesterday.start &&
      mins < yesterday.end
    ) {
      return {
        open: true,
        label: 'Open',
        detail: `Tot ${formatMins(yesterday.end)}`,
        today,
      };
    }

    if (!today || today.closed) {
      return { open: false, label: 'Gesloten', detail: nextOpenLabel(date), today };
    }

    if (isWithinWindow(mins, today.start, today.end)) {
      const until =
        today.end < today.start
          ? formatMins(today.end) + ' (nacht)'
          : formatMins(today.end);
      return { open: true, label: 'Open', detail: `Tot ${until}`, today };
    }

    if (mins < today.start) {
      return {
        open: false,
        label: 'Gesloten',
        detail: `Open vandaag om ${formatMins(today.start)}`,
        today,
      };
    }

    return {
      open: false,
      label: 'Gesloten',
      detail: nextOpenLabel(date),
      today,
    };
  }

  function formatMins(m) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }

  function nextOpenLabel(date) {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(date);
      d.setDate(d.getDate() + i);
      const h = getDayHours(d.getDay());
      if (h && !h.closed) {
        const name = i === 1 ? 'morgen' : h.label.toLowerCase();
        return `Open ${name} om ${formatMins(h.start)}`;
      }
    }
    return 'Momenteel gesloten';
  }

  function formatHoursRange(h) {
    if (h.closed) return 'Gesloten';
    if (h.end < h.start) {
      return `${formatMins(h.start)} – ${formatMins(h.end)}`;
    }
    return `${formatMins(h.start)} – ${formatMins(h.end)}`;
  }

  // ——— Toast ———
  function showToast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ——— Cart mutations ———
  function addToCart(id, qty = 1) {
    cart[id] = (cart[id] || 0) + qty;
    saveCart();
    renderCart();
    updateBadges();
    showToast('Toegevoegd aan winkelwagen');
  }

  function setQty(id, qty) {
    if (qty <= 0) {
      delete cart[id];
    } else {
      cart[id] = qty;
    }
    saveCart();
    renderCart();
    updateBadges();
  }

  function clearCart() {
    cart = {};
    saveCart();
    renderCart();
    updateBadges();
  }

  // ——— Render menu ———
  function renderMenu() {
    const rail = document.getElementById('category-rail');
    const popularWrap = document.getElementById('popular-grid');
    const menuWrap = document.getElementById('menu-sections');
    if (!rail || !menuWrap) return;

    // Category rail
    rail.innerHTML = MENU.map(
      (cat) =>
        `<button type="button" data-cat="${cat.id}" class="cat-pill shrink-0 px-4 py-2 rounded-full text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:border-brand hover:text-brand transition-colors whitespace-nowrap">${escapeHtml(cat.name)}</button>`
    ).join('');

    rail.querySelectorAll('.cat-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById('cat-' + btn.dataset.cat);
        if (target) {
          const offset = 140;
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    });

    // Popular
    const popular = MENU.flatMap((c) => c.items).filter((i) => i.popular);
    popularWrap.innerHTML = popular.map(dishCard).join('');

    // Categories
    menuWrap.innerHTML = MENU.map(
      (cat) => `
      <section id="cat-${cat.id}" class="menu-category scroll-mt-36 mb-10" data-cat-id="${cat.id}">
        <h3 class="text-xl font-bold text-gray-900 mb-4">${escapeHtml(cat.name)}</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          ${cat.items.map(dishCard).join('')}
        </div>
      </section>`
    ).join('');

    document.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(btn.dataset.add));
    });
  }

  function dishCard(item) {
    const tags = (item.tags || [])
      .map(
        (t) =>
          `<span class="inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand-light text-brand">${escapeHtml(t)}</span>`
      )
      .join('');
    return `
      <article class="dish-card bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-row sm:flex-col">
        <div class="dish-img w-24 h-24 shrink-0 sm:w-full sm:h-auto sm:aspect-[4/3] overflow-hidden">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-full object-cover" width="400" height="300" onerror="this.style.display='none'">
        </div>
        <div class="p-3 sm:p-4 flex flex-col flex-1 min-w-0">
          <h4 class="font-semibold text-gray-900 leading-snug text-sm sm:text-base">${escapeHtml(item.name)}</h4>
          ${item.desc ? `<p class="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">${escapeHtml(item.desc)}</p>` : ''}
          ${tags ? `<div class="mt-1.5 sm:mt-2 flex flex-wrap gap-1">${tags}</div>` : ''}
          <div class="mt-auto pt-2 sm:pt-3 flex items-center justify-between gap-2">
            <span class="font-bold text-brand text-sm sm:text-base">${euro(item.price)}</span>
            <button type="button" data-add="${item.id}" aria-label="Toevoegen" class="inline-flex items-center justify-center shrink-0 w-9 h-9 sm:w-auto sm:h-auto sm:gap-1.5 sm:px-3 sm:py-2 rounded-full sm:rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              <span class="hidden sm:inline">Toevoegen</span>
            </button>
          </div>
        </div>
      </article>`;
  }

  // ——— Mobile bottom bar stacking ———
  function isMobileLayout() {
    return window.matchMedia('(max-width: 1023px)').matches;
  }

  function updateBottomStack() {
    const root = document.documentElement;
    if (!isMobileLayout()) {
      root.style.setProperty('--cookie-h', '0px');
      root.style.setProperty('--cart-bar-h', '0px');
      return;
    }

    const cookieBanner = document.getElementById('cookie-banner');
    const mobileBar = document.getElementById('mobile-cart-bar');

    let cookieH = 0;
    if (cookieBanner?.classList.contains('show')) {
      cookieH = cookieBanner.offsetHeight;
    }

    let cartBarH = 0;
    if (mobileBar && !mobileBar.classList.contains('hidden')) {
      cartBarH = mobileBar.offsetHeight;
    }

    root.style.setProperty('--cookie-h', `${cookieH}px`);
    root.style.setProperty('--cart-bar-h', `${cartBarH}px`);
  }

  function setupBottomStack() {
    const cookieBanner = document.getElementById('cookie-banner');
    const mobileBar = document.getElementById('mobile-cart-bar');
    const observer = new ResizeObserver(() => updateBottomStack());

    if (cookieBanner) observer.observe(cookieBanner);
    if (mobileBar) observer.observe(mobileBar);

    window.matchMedia('(max-width: 1023px)').addEventListener('change', updateBottomStack);
    updateBottomStack();
  }

  // ——— Cart UI ———
  function updateBadges() {
    const count = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      const show = count > 0;
      el.classList.toggle('hidden', !show);
      el.classList.toggle('inline-flex', show);
      el.classList.remove('badge-pop');
      void el.offsetWidth;
      if (show) el.classList.add('badge-pop');
    });
    document.querySelectorAll('[data-cart-total]').forEach((el) => {
      el.textContent = euro(cartTotals().total);
    });
    const mobileBar = document.getElementById('mobile-cart-bar');
    if (mobileBar) {
      // Keep lg:hidden so it never shows on desktop
      mobileBar.classList.toggle('hidden', count === 0);
    }
    updateBottomStack();
  }

  function renderCart() {
    const targets = [
      document.getElementById('cart-sidebar-body'),
      document.getElementById('cart-drawer-body'),
    ].filter(Boolean);

    const { subtotal, discount, delivery, total, minOrder, meetsMin } = cartTotals();
    const entries = Object.entries(cart);

    const emptyHtml = `
      <div class="text-center py-10 px-4">
        <div class="mx-auto w-14 h-14 rounded-full bg-brand-light flex items-center justify-center mb-3">
          <svg class="w-7 h-7 text-brand" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>
        </div>
        <p class="text-sm text-gray-500">Uw winkelwagen is leeg! Klik op het icoontje om gerechten aan uw bestelling toe te voegen.</p>
      </div>`;

    let linesHtml = '';
    if (entries.length === 0) {
      linesHtml = emptyHtml;
    } else {
      linesHtml = `<ul class="divide-y divide-gray-100">` +
        entries
          .map(([id, qty]) => {
            const item = findItem(id);
            if (!item) return '';
            return `
            <li class="py-3 flex gap-3">
              <img src="${escapeHtml(item.image)}" alt="" class="w-14 h-14 rounded-xl object-cover shrink-0" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none'">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">${escapeHtml(item.name)}</p>
                <p class="text-sm text-brand font-semibold">${euro(item.price)}</p>
                <div class="mt-1.5 inline-flex items-center rounded-lg border border-gray-200 overflow-hidden">
                  <button type="button" data-qty-dec="${id}" class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50" aria-label="Verminderen">−</button>
                  <span class="w-8 text-center text-sm font-medium">${qty}</span>
                  <button type="button" data-qty-inc="${id}" class="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50" aria-label="Meer">+</button>
                </div>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-semibold text-gray-900">${euro(item.price * qty)}</p>
                <button type="button" data-qty-rem="${id}" class="mt-1 text-xs text-gray-400 hover:text-red-500" aria-label="Verwijderen">Verwijder</button>
              </div>
            </li>`;
          })
          .join('') +
        `</ul>`;
    }

    const summaryHtml = `
      <div class="border-t border-gray-200 pt-4 space-y-2 text-sm">
        <div class="flex justify-between text-gray-600"><span>Subtotaal</span><span>${euro(subtotal)}</span></div>
        ${
          discount > 0
            ? `<div class="flex justify-between text-brand font-medium"><span>Korting ${RESTAURANT.discountPercent}%</span><span>− ${euro(discount)}</span></div>`
            : subtotal > 0 && subtotal < RESTAURANT.discountThreshold
              ? `<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">Nog ${euro(RESTAURANT.discountThreshold - subtotal)} tot ${RESTAURANT.discountPercent}% korting!</p>`
              : ''
        }
        ${
          fulfillment === 'delivery' && subtotal > 0
            ? `<div class="flex justify-between text-gray-600"><span>Bezorgkosten</span><span>${euro(delivery)}</span></div>`
            : ''
        }
        <div class="flex justify-between text-base font-bold text-gray-900 pt-1"><span>Totaal</span><span data-cart-total>${euro(total)}</span></div>
        ${
          entries.length && !meetsMin
            ? `<p class="text-xs text-red-600">Minimumbestelling ${fulfillment === 'delivery' ? 'bezorgen' : 'afhalen'}: ${euro(minOrder)}</p>`
            : ''
        }
        <div class="flex rounded-xl bg-gray-100 p-1 gap-1 mt-2">
          <button type="button" data-fulfill="delivery" class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${fulfillment === 'delivery' ? 'bg-white shadow text-brand' : 'text-gray-600'}">Bezorgen</button>
          <button type="button" data-fulfill="pickup" class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${fulfillment === 'pickup' ? 'bg-white shadow text-brand' : 'text-gray-600'}">Afhalen</button>
        </div>
        <button type="button" data-checkout class="w-full mt-2 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed" ${!entries.length || !meetsMin ? 'disabled' : ''}>
          Afrekenen
        </button>
      </div>`;

    targets.forEach((el) => {
      el.innerHTML = linesHtml + (entries.length ? summaryHtml : '');
    });

    // Bind qty / fulfill / checkout
    document.querySelectorAll('[data-qty-inc]').forEach((b) =>
      b.addEventListener('click', () => setQty(b.dataset.qtyInc, (cart[b.dataset.qtyInc] || 0) + 1))
    );
    document.querySelectorAll('[data-qty-dec]').forEach((b) =>
      b.addEventListener('click', () => setQty(b.dataset.qtyDec, (cart[b.dataset.qtyDec] || 0) - 1))
    );
    document.querySelectorAll('[data-qty-rem]').forEach((b) =>
      b.addEventListener('click', () => setQty(b.dataset.qtyRem, 0))
    );
    document.querySelectorAll('[data-fulfill]').forEach((b) =>
      b.addEventListener('click', () => {
        fulfillment = b.dataset.fulfill;
        renderCart();
        updateCheckoutForm();
      })
    );
    document.querySelectorAll('[data-checkout]').forEach((b) =>
      b.addEventListener('click', () => openCheckout())
    );
  }

  // ——— Drawer ———
  function openDrawer() {
    lastFocused = document.activeElement;
    document.getElementById('cart-overlay')?.classList.add('open');
    document.getElementById('cart-drawer')?.classList.add('open');
    document.body.classList.add('overflow-hidden');
    document.getElementById('cart-drawer')?.setAttribute('aria-hidden', 'false');
    document.getElementById('drawer-close')?.focus();
  }

  function closeDrawer() {
    document.getElementById('cart-overlay')?.classList.remove('open');
    document.getElementById('cart-drawer')?.classList.remove('open');
    document.body.classList.remove('overflow-hidden');
    document.getElementById('cart-drawer')?.setAttribute('aria-hidden', 'true');
    lastFocused?.focus?.();
  }

  // ——— Checkout modal ———
  function openCheckout() {
    closeDrawer();
    lastFocused = document.activeElement;
    const backdrop = document.getElementById('modal-backdrop');
    const panel = document.getElementById('checkout-modal');
    const formView = document.getElementById('checkout-form-view');
    const successView = document.getElementById('checkout-success-view');
    if (!backdrop || !panel) return;

    formView?.classList.remove('hidden');
    successView?.classList.add('hidden');
    updateCheckoutForm();
    syncCheckoutSummary();

    backdrop.classList.add('open');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
    document.getElementById('checkout-name')?.focus();
  }

  function closeCheckout() {
    document.getElementById('modal-backdrop')?.classList.remove('open');
    document.getElementById('checkout-modal')?.classList.remove('open');
    document.getElementById('checkout-modal')?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
    lastFocused?.focus?.();
  }

  function updateCheckoutForm() {
    const addr = document.getElementById('checkout-address-fields');
    const isDelivery = fulfillment === 'delivery';
    if (addr) addr.classList.toggle('hidden', !isDelivery);
    document.querySelectorAll('[data-checkout-fulfill]').forEach((b) => {
      const active = b.dataset.checkoutFulfill === fulfillment;
      b.classList.toggle('bg-white', active);
      b.classList.toggle('shadow', active);
      b.classList.toggle('text-brand', active);
      b.classList.toggle('text-gray-600', !active);
    });
  }

  function syncCheckoutSummary() {
    const box = document.getElementById('checkout-summary');
    if (!box) return;
    const { subtotal, discount, delivery, total } = cartTotals();
    const lines = Object.entries(cart)
      .map(([id, qty]) => {
        const item = findItem(id);
        if (!item) return '';
        return `<div class="flex justify-between text-sm"><span class="text-gray-600">${qty}× ${escapeHtml(item.name)}</span><span>${euro(item.price * qty)}</span></div>`;
      })
      .join('');
    box.innerHTML = `
      <div class="space-y-1.5">${lines}</div>
      <div class="border-t border-gray-200 mt-3 pt-3 space-y-1 text-sm">
        <div class="flex justify-between text-gray-600"><span>Subtotaal</span><span>${euro(subtotal)}</span></div>
        ${discount > 0 ? `<div class="flex justify-between text-brand"><span>Korting</span><span>− ${euro(discount)}</span></div>` : ''}
        ${delivery > 0 ? `<div class="flex justify-between text-gray-600"><span>Bezorgkosten</span><span>${euro(delivery)}</span></div>` : ''}
        <div class="flex justify-between font-bold text-gray-900"><span>Totaal</span><span>${euro(total)}</span></div>
      </div>`;
  }

  function submitCheckout(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email.value.trim();
    const address = form.address?.value.trim() || '';
    const postcode = form.postcode?.value.trim() || '';
    const city = form.city?.value.trim() || '';
    const note = form.note?.value.trim() || '';

    if (!name || !phone || !email) {
      showToast('Vul alle verplichte velden in');
      return;
    }
    if (fulfillment === 'delivery' && (!address || !postcode || !city)) {
      showToast('Vul uw bezorgadres in');
      return;
    }

    const { total } = cartTotals();
    const orderId = 'SK-' + Date.now().toString(36).toUpperCase();

    document.getElementById('checkout-form-view')?.classList.add('hidden');
    const success = document.getElementById('checkout-success-view');
    if (success) {
      success.classList.remove('hidden');
      success.querySelector('[data-order-id]').textContent = orderId;
      success.querySelector('[data-order-total]').textContent = euro(total);
      success.querySelector('[data-order-type]').textContent =
        fulfillment === 'delivery' ? 'Bezorgen' : 'Afhalen';
      success.querySelector('[data-order-name]').textContent = name;
      if (note) {
        // keep note unused visually but available
      }
    }

    clearCart();
  }

  // ——— Status / hours UI ———
  function updateStatusUI() {
    const status = getOpenStatus();
    document.querySelectorAll('[data-open-status]').forEach((el) => {
      el.textContent = status.label;
      el.classList.toggle('bg-brand', status.open);
      el.classList.toggle('bg-red-500', !status.open);
    });
    document.querySelectorAll('[data-open-detail]').forEach((el) => {
      el.textContent = status.detail;
    });

    const notice = document.getElementById('closed-notice');
    if (notice) {
      notice.classList.toggle('hidden', status.open);
      const detail = notice.querySelector('[data-closed-detail]');
      if (detail) detail.textContent = status.detail;
    }

    // Highlight today in hours table
    const today = new Date().getDay();
    document.querySelectorAll('[data-hours-day]').forEach((row) => {
      const isToday = Number(row.dataset.hoursDay) === today;
      row.classList.toggle('bg-brand-light', isToday);
      row.classList.toggle('font-semibold', isToday);
    });
  }

  // ——— Reviews ———
  function renderReviews() {
    const grid = document.getElementById('reviews-grid');
    if (!grid) return;
    grid.innerHTML = REVIEWS.map(
      (r) => `
      <article class="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <p class="font-semibold text-gray-900">${escapeHtml(r.name)}</p>
          <span class="text-xs text-gray-400">${escapeHtml(r.date)}</span>
        </div>
        <div class="flex gap-0.5 mb-2 text-amber-400" aria-label="${r.rating} van 5 sterren">
          ${Array.from({ length: 5 }, (_, i) =>
            i < r.rating
              ? '<svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>'
              : '<svg class="w-4 h-4 text-gray-200 fill-current" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>'
          ).join('')}
        </div>
        <p class="text-sm text-gray-600 leading-relaxed">${escapeHtml(r.text)}</p>
      </article>`
    ).join('');
  }

  function renderHoursTable() {
    const tbody = document.getElementById('hours-tbody');
    if (!tbody) return;
    // Display Mon→Sun order
    const order = [1, 2, 3, 4, 5, 6, 0];
    tbody.innerHTML = order
      .map((d) => {
        const h = getDayHours(d);
        return `<tr data-hours-day="${d}" class="border-b border-gray-100">
          <td class="py-2.5 pr-4 text-gray-700">${escapeHtml(h.label)}</td>
          <td class="py-2.5 text-right text-gray-900">${formatHoursRange(h)}</td>
        </tr>`;
      })
      .join('');
  }

  function renderDeliveryAreas() {
    const wrap = document.getElementById('delivery-areas');
    if (!wrap) return;
    wrap.innerHTML = DELIVERY_AREAS.map(
      (a) => `
      <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
        <h4 class="font-semibold text-gray-900">${escapeHtml(a.name)}</h4>
        <p class="text-sm text-gray-500 mt-1">${escapeHtml(a.postcodes)}</p>
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span class="px-2 py-1 rounded-full bg-brand-light text-brand font-medium">${escapeHtml(a.time)}</span>
          <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-600">Min. ${euro(a.min)}</span>
        </div>
      </div>`
    ).join('');
  }

  // ——— Scroll spy ———
  function setupScrollSpy() {
    const sections = document.querySelectorAll('.menu-category');
    const rail = document.getElementById('category-rail');
    if (!sections.length || !rail) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.dataset.catId;
          rail.querySelectorAll('.cat-pill').forEach((btn) => {
            const active = btn.dataset.cat === id;
            btn.classList.toggle('bg-brand', active);
            btn.classList.toggle('text-white', active);
            btn.classList.toggle('border-brand', active);
            btn.classList.toggle('bg-white', !active);
            btn.classList.toggle('text-gray-700', !active);
            btn.classList.toggle('border-gray-200', !active);
            if (active) {
              btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }
          });
        });
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
  }

  // ——— Mobile nav ———
  function setupMobileNav() {
    const btn = document.getElementById('mobile-nav-toggle');
    const panel = document.getElementById('mobile-nav');
    if (!btn || !panel) return;

    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('hidden') === false;
      btn.setAttribute('aria-expanded', String(open));
    });

    panel.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      })
    );
  }

  // ——— Cookie banner ———
  function setupCookies() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;
    if (!localStorage.getItem(COOKIE_KEY)) {
      requestAnimationFrame(() => {
        banner.classList.add('show');
        updateBottomStack();
      });
    }
    document.getElementById('cookie-accept')?.addEventListener('click', () => {
      localStorage.setItem(COOKIE_KEY, 'accepted');
      banner.classList.remove('show');
      updateBottomStack();
    });
    document.getElementById('cookie-reject')?.addEventListener('click', () => {
      localStorage.setItem(COOKIE_KEY, 'rejected');
      banner.classList.remove('show');
      updateBottomStack();
    });
  }

  // ——— Focus trap helpers ———
  function trapFocus(container, e) {
    if (e.key !== 'Tab' || !container) return;
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ——— Init ———
  function init() {
    renderMenu();
    renderReviews();
    renderHoursTable();
    renderDeliveryAreas();
    renderCart();
    updateBadges();
    updateStatusUI();
    setupScrollSpy();
    setupMobileNav();
    setupCookies();
    setupBottomStack();

    // Refresh open status every minute
    setInterval(updateStatusUI, 60_000);

    // Cart openers
    document.querySelectorAll('[data-open-cart]').forEach((b) =>
      b.addEventListener('click', openDrawer)
    );
    document.getElementById('cart-overlay')?.addEventListener('click', closeDrawer);
    document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
    document.getElementById('mobile-cart-bar')?.addEventListener('click', openDrawer);

    // Checkout
    document.getElementById('modal-backdrop')?.addEventListener('click', closeCheckout);
    document.getElementById('checkout-modal')?.addEventListener('click', (e) => {
      // Click on the dimmed area around the panel (not the panel itself)
      if (e.target === e.currentTarget) closeCheckout();
    });
    document.getElementById('checkout-close')?.addEventListener('click', closeCheckout);
    document.getElementById('checkout-done')?.addEventListener('click', closeCheckout);
    document.getElementById('checkout-form')?.addEventListener('submit', submitCheckout);
    document.querySelectorAll('[data-checkout-fulfill]').forEach((b) =>
      b.addEventListener('click', () => {
        fulfillment = b.dataset.checkoutFulfill;
        renderCart();
        updateCheckoutForm();
        syncCheckoutSummary();
      })
    );

    // Newsletter
    document.getElementById('newsletter-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Bedankt voor uw aanmelding!');
      e.target.reset();
    });

    // Escape + focus trap
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('checkout-modal')?.classList.contains('open')) {
          closeCheckout();
        } else if (document.getElementById('cart-drawer')?.classList.contains('open')) {
          closeDrawer();
        }
      }
      if (document.getElementById('checkout-modal')?.classList.contains('open')) {
        trapFocus(document.getElementById('checkout-modal'), e);
      } else if (document.getElementById('cart-drawer')?.classList.contains('open')) {
        trapFocus(document.getElementById('cart-drawer'), e);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
