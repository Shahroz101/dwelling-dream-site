  import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { getCart, addItem, setQty, removeItem, getSubtotal, getDiscount, getTotal, getCoupons, applyCoupon, removeCoupon, onCartChange, refresh, isLoaded, syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';

  // Same page as the design file; the cart itself now lives in WooCommerce
  // (see js/cart.js), so rows key on the cart-item key, checkout is
  // WooCommerce's, and promo codes are WooCommerce coupons.
  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ASSETS = '<?php echo DD_ASSETS; ?>';
  const SYMBOL = <?php echo wp_json_encode(dd_currency_symbol()); ?>;

  const PALETTE_SWATCHES = {
    'sea salt': ['#DCDDD8', '#EDEAE0', '#F0E1D8', '#D1C7B8', '#CDD2CA', '#C8CBC4', '#596E79', '#2F3D4C', '#434341'],
    'greek villa': ['#EDECE6', '#F0ECE2', '#DFD3C3', '#C8BCAB', '#95978A', '#CDD2CA', '#708D9E', '#7B8070', '#5D6F7F'],
    'redend point': ['#EDEAE0', '#E6DFD3', '#D1C7B8', '#95978A', '#C0B2A2', '#AE8E7E', '#AC6B53', '#7A8076', '#434341'],
    'anew gray': ['#E2DED8', '#D3CEC4', '#C8CBC4', '#A6B2B5', '#BFB6AA', '#95978A', '#92948D', '#908A83', '#5D6F7F'],
    'iron ore': ['#EDECE6', '#EDEAE0', '#D1CBC1', '#CDB592', '#95978A', '#AA866E', '#7C8E87', '#434341', '#2F3D4C'],
    'naval': ['#EDECE6', '#F0ECE2', '#E5DFD2', '#CDD2CA', '#D1CBC1', '#ADBBB2', '#A6B2B5', '#98A9B7', '#2F3D4C'],
    'french country': ['#EDEAE0', '#DFD3C3', '#ACAD97', '#C2DAE0', '#D1C6D2', '#EBD1CF', '#817A6E', '#9BBFC9', '#78736E'],
    'coastal farmhouse': ['#EDEAE0', '#E6DFD3', '#DCD8D0', '#DFD3C3', '#CDD2D2', '#BCCBCE', '#CDD2CA', '#98A9B7', '#2F3D4C'],
    'beach house': ['#F2EFE8', '#EEE8DD', '#E4D7C4', '#F2E4DE', '#D6DBD4', '#ABBFB4', '#A6B2B5', '#98A9B7', '#465667'],
    'cottagecore': ['#EDEAE0', '#E6DFD3', '#D1C7B8', '#CBB8C0', '#BFC9D0', '#DECABD', '#CDD2CA', '#7B8070', '#708D9E'],
    'cozy neutral': ['#EDEAE0', '#F5F2E8', '#DFD3C3', '#BFC9D0', '#EADCD2', '#ACAD97', '#7B8070', '#9E8F7C', '#78736E'],
    'bohemian': ['#F0ECE2', '#DFD3C3', '#CDB592', '#BFC9D0', '#CDD2CA', '#DECABD', '#AC6B53', '#7B8070', '#54504A'],
    'mid-century': ['#EDEAE0', '#D6CEC3', '#CBA576', '#A0AEAF', '#AE8E7E', '#AC6B53', '#596E79', '#7B8070', '#54504A']
  };
  const PALETTE_ALIASES = { boho: 'bohemian', 'mid century': 'mid-century', midcentury: 'mid-century' };
  const NEUTRAL_SWATCHES = ['#F5F2EA', '#EDEAE0', '#E3DED3', '#D8D2C8', '#DDD7CC', '#C8CBC4', '#A9A29A', '#78736E', '#292825'];

  function normalizeTitle(title) {
    return String(title || '').toLowerCase().replace(/palettes?|paints?/g, '').replace(/[^a-z\s-]/g, '').trim().replace(/\s+/g, ' ');
  }

  function paletteKeyFor(title) {
    const key = normalizeTitle(title);
    if (PALETTE_SWATCHES[key]) return key;
    if (PALETTE_ALIASES[key]) return PALETTE_ALIASES[key];
    const match = Object.keys(PALETTE_SWATCHES).find(k => key.includes(k) || k.includes(key));
    return match || null;
  }

  function getSwatches(title) {
    const key = paletteKeyFor(title);
    return key ? PALETTE_SWATCHES[key] : NEUTRAL_SWATCHES;
  }

  function swatchStripHTML(hexes) {
    return `<div data-swatch-strip style="display: flex; gap: 2px; height: 14px; width: 100%; max-width: 220px;">${hexes.map(hex => `<span data-swatch style="flex: 1; background: ${hex}; transform-origin: bottom; transition: transform .35s cubic-bezier(.22,1,.36,1);"></span>`).join('')}</div>`;
  }

  function animateSwatches(container, scaleUp) {
    if (REDUCED || !container) return;
    Array.from(container.querySelectorAll('[data-swatch]')).forEach((swatch, i) => {
      swatch.style.transitionDelay = `${i * 18}ms`;
      swatch.style.transform = scaleUp ? 'scaleY(1.35)' : 'scaleY(1)';
    });
  }

  const escapeHtml = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function normalizeImageUrl(image) {
    return image || `${ASSETS}/dd2-feat-seasalt.webp`;
  }

  const formatPrice = amount => `${SYMBOL}${Number(amount || 0).toFixed(2)}`;

  let catalogCache = null;
  async function loadCatalog() {
    if (catalogCache) return catalogCache;
    try {
      const response = await fetch('/wp-json/dd/v1/products');
      if (!response.ok) return [];
      const data = await response.json();
      catalogCache = Array.isArray(data.products) ? data.products : [];
      return catalogCache;
    } catch (error) {
      console.error('Failed to load catalog:', error);
      return [];
    }
  }

  // The Store API does not say which brand a cart line belongs to; the
  // catalogue does.
  function brandFor(item) {
    const product = (catalogCache || []).find(p => String(p.id) === String(item.id));
    return product ? product.category : '';
  }

  const toast = document.querySelector('[data-toast]');
  const toastText = toast ? toast.querySelector('[data-toast-text]') : null;
  const toastUndo = toast ? toast.querySelector('[data-toast-undo]') : null;
  let toastTimer = null;

  function showToast(message, onUndo) {
    if (!toast || !toastText) return;
    clearTimeout(toastTimer);
    toastText.textContent = message;
    if (onUndo) {
      toastUndo.hidden = false;
      toastUndo.style.display = 'inline-block';
      toastUndo.onclick = () => {
        onUndo();
        hideToast();
      };
    } else {
      toastUndo.hidden = true;
      toastUndo.style.display = 'none';
      toastUndo.onclick = null;
    }
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
    toastTimer = setTimeout(hideToast, onUndo ? 5000 : 2400);
  }

  function hideToast() {
    if (!toast) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 140%)';
  }

  function computeAtmosphere(items) {
    const atmosphereEl = document.querySelector('[data-atmosphere]');
    const bandEl = document.querySelector('[data-color-band]');
    if (!atmosphereEl || !bandEl) return;

    const keys = [...new Set(items.map(item => paletteKeyFor(item.title)).filter(Boolean))];

    if (keys.length === 0) {
      atmosphereEl.style.background = 'radial-gradient(58% 58% at 18% 0%, #ACAD97, transparent 70%)';
      atmosphereEl.style.opacity = '.045';
      bandEl.hidden = true;
      bandEl.style.display = 'none';
      return;
    }

    if (keys.length === 1) {
      const hexes = PALETTE_SWATCHES[keys[0]];
      const accent = hexes[Math.floor(hexes.length / 2)];
      atmosphereEl.style.background = `radial-gradient(58% 58% at 18% 0%, ${accent}, transparent 70%)`;
      atmosphereEl.style.opacity = '.08';
      bandEl.hidden = true;
      bandEl.style.display = 'none';
    } else {
      const accents = keys.map(key => {
        const hexes = PALETTE_SWATCHES[key];
        return hexes[Math.floor(hexes.length / 2)];
      });
      bandEl.style.background = `linear-gradient(90deg, ${accents.join(', ')})`;
      bandEl.hidden = false;
      bandEl.style.display = 'block';
      atmosphereEl.style.opacity = '.03';
    }
  }

  function applyResponsive() {
    const narrow = window.innerWidth < 900;
    const filled = document.querySelector('[data-cart-filled]');
    const empty = document.querySelector('[data-cart-empty]');
    if (filled) filled.style.gridTemplateColumns = narrow ? '1fr' : '3fr 2fr';
    if (empty) empty.style.gridTemplateColumns = narrow ? '1fr' : '1fr 1fr';
  }
  window.addEventListener('resize', applyResponsive);

  const reportError = error => showToast(error && error.message ? error.message : 'The cart could not be updated.');

  function wireQtyRow(row, item) {
    const inc = row.querySelector('[data-cart-inc]');
    const dec = row.querySelector('[data-cart-dec]');
    const removeBtn = row.querySelector('[data-cart-remove]');
    const thumbImg = row.querySelector('[data-thumb-img]');
    const thumb = row.querySelector('[data-thumb]');

    inc.addEventListener('click', () => setQty(item.key, item.qty + 1).catch(reportError));
    dec.addEventListener('click', () => setQty(item.key, item.qty - 1).catch(reportError));

    removeBtn.addEventListener('click', () => {
      const snapshot = { ...item };
      row.style.maxHeight = row.scrollHeight + 'px';
      requestAnimationFrame(() => {
        row.style.overflow = 'hidden';
        row.style.opacity = '0';
        row.style.transform = 'translateX(14px)';
        row.style.maxHeight = '0px';
        row.style.paddingTop = '0px';
        row.style.paddingBottom = '0px';
      });
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        removeItem(item.key).catch(reportError);
      };
      if (REDUCED) {
        finish();
      } else {
        row.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 600);
      }
      showToast(`${snapshot.title} removed`, () => addItem({ id: snapshot.id }, snapshot.qty).catch(reportError));
    });

    if (!REDUCED) {
      row.addEventListener('pointerenter', () => {
        if (thumbImg) thumbImg.style.transform = 'scale(1.07)';
        if (thumb) thumb.style.boxShadow = '0 16px 32px rgba(41,40,37,.15)';
      });
      row.addEventListener('pointerleave', () => {
        if (thumbImg) thumbImg.style.transform = 'none';
        if (thumb) thumb.style.boxShadow = 'none';
      });
    }
  }

  function renderCartRow(item) {
    const row = document.createElement('div');
    row.setAttribute('data-cart-row', '');
    row.style.cssText = 'display:flex; gap:18px; align-items:flex-start; padding:26px 0; border-bottom:1px solid #D8D2C8; opacity:0; transform:translateY(10px); transition: opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1), max-height .45s ease, padding .45s ease;';
    row.innerHTML = `
      <div data-thumb style="flex: 0 0 auto; width: 108px; height: 108px; overflow: hidden; background: #E3DED3; transition: box-shadow .4s ease;">
        <img data-thumb-img src="${escapeHtml(normalizeImageUrl(item.image))}" alt="${escapeHtml(item.title)}" style="width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .6s cubic-bezier(.22,1,.36,1);" />
      </div>
      <div style="flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 9px;">
        <div>
          <p style="margin: 0 0 4px; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: #A9A29A;">${escapeHtml(brandFor(item) || 'Palette')}</p>
          <h3 style="margin: 0 0 5px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(19px, 1.7vw, 25px); line-height: 1;">${escapeHtml(item.title)}</h3>
          <p style="margin: 0; font-size: 11.5px; letter-spacing: .06em; color: #78736E;">9 curated colors · Digital Download</p>
        </div>
        <div style="display: flex; align-items: center; gap: 18px; margin-top: 2px;">
          <div style="display: flex; align-items: center; gap: 4px; border: 1px solid #D8D2C8; border-radius: 999px; padding: 4px 6px;">
            <button type="button" data-cart-dec aria-label="Decrease quantity" style="width: 26px; height: 26px; border: 0; border-radius: 50%; background: none; font-size: 15px; cursor: pointer;">−</button>
            <span style="min-width: 18px; text-align: center; font-size: 13px;">${item.qty}</span>
            <button type="button" data-cart-inc aria-label="Increase quantity" style="width: 26px; height: 26px; border: 0; border-radius: 50%; background: none; font-size: 15px; cursor: pointer;">+</button>
          </div>
          <button type="button" data-cart-remove style="border: 0; background: none; padding: 0; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #78736E; cursor: pointer; border-bottom: 1px solid #D8D2C8;">Remove</button>
        </div>
      </div>
      <p style="flex: 0 0 auto; width: 78px; text-align: right; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px;">${formatPrice(item.lineTotal)}</p>
    `;
    wireQtyRow(row, item);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      row.style.opacity = '1';
      row.style.transform = 'none';
    }));
    return row;
  }

  async function renderEmptyPreviews() {
    const wrap = document.querySelector('[data-empty-previews]');
    if (!wrap) return;
    const products = await loadCatalog();
    wrap.innerHTML = products.slice(0, 3).map(product => `
      <a href="/palettes/${escapeHtml(product.slug)}/" style="display: flex; flex-direction: column; gap: 6px; width: 76px; text-decoration: none; color: inherit;">
        <span style="display: block; aspect-ratio: 1; overflow: hidden; background: #E3DED3;"><img src="${escapeHtml(normalizeImageUrl(Array.isArray(product.images) ? product.images[0] : null))}" alt="${escapeHtml(product.title || 'Palette')}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" /></span>
        <span style="font-size: 10.5px; letter-spacing: .04em; color: #5F5A54;">${escapeHtml(product.title || 'Palette')}</span>
      </a>
    `).join('');
  }

  function renderCart() {
    // Rows need the catalogue (for brands) and the cart; wait for both.
    if (!isLoaded() || !catalogCache) return;
    const items = getCart();
    const emptyEl = document.querySelector('[data-cart-empty]');
    const filledEl = document.querySelector('[data-cart-filled]');
    const listEl = document.querySelector('[data-cart-items]');
    const countEl = document.querySelector('[data-cart-item-count]');
    const subtotalEl = document.querySelector('[data-cart-subtotal]');
    const discountRow = document.querySelector('[data-discount-row]');
    const discountEl = document.querySelector('[data-cart-discount]');
    const totalEl = document.querySelector('[data-cart-total]');

    const hasItems = items.length > 0;
    if (emptyEl) {
      emptyEl.hidden = hasItems;
      emptyEl.style.display = hasItems ? 'none' : 'grid';
    }
    if (filledEl) {
      filledEl.hidden = !hasItems;
      filledEl.style.display = hasItems ? 'grid' : 'none';
    }
    applyResponsive();
    computeAtmosphere(items);

    if (countEl) {
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      countEl.textContent = hasItems ? `${totalQty} palette${totalQty === 1 ? '' : 's'} in your cart` : '';
    }

    if (!hasItems) {
      renderEmptyPreviews();
      const button = document.querySelector('[data-checkout]');
      if (button) button.style.display = 'none';
      const msg = document.querySelector('[data-checkout-msg]');
      if (msg) msg.textContent = '';
      return;
    }
    if (!listEl) return;

    listEl.innerHTML = '';
    items.forEach(item => listEl.appendChild(renderCartRow(item)));

    if (subtotalEl) subtotalEl.textContent = formatPrice(getSubtotal());
    const discount = getDiscount();
    if (discountRow) {
      discountRow.hidden = discount <= 0;
      discountRow.style.display = discount > 0 ? 'flex' : 'none';
    }
    if (discountEl) discountEl.textContent = `-${formatPrice(discount)}`;
    if (totalEl) totalEl.textContent = formatPrice(getTotal());

    const coupons = getCoupons();
    const promoInput = document.querySelector('[data-promo-input]');
    if (promoInput && coupons.length && !promoInput.value) promoInput.value = coupons[0];

    showCheckoutButton();
  }

  // --- Promo codes: WooCommerce coupons.
  const promoInput = document.querySelector('[data-promo-input]');
  const promoApply = document.querySelector('[data-promo-apply]');
  const promoMsg = document.querySelector('[data-promo-msg]');
  if (promoApply && promoInput) {
    promoApply.addEventListener('click', async () => {
      const code = promoInput.value.trim();
      if (!code) return;
      promoApply.disabled = true;
      if (promoMsg) promoMsg.textContent = 'Checking…';
      try {
        const applied = getCoupons();
        for (const existing of applied) {
          if (existing.toLowerCase() !== code.toLowerCase()) await removeCoupon(existing);
        }
        if (!applied.some(c => c.toLowerCase() === code.toLowerCase())) await applyCoupon(code);
        if (promoMsg) promoMsg.textContent = `Code ${code.toUpperCase()} applied`;
      } catch (error) {
        if (promoMsg) promoMsg.textContent = error.message || 'That code could not be applied.';
      } finally {
        promoApply.disabled = false;
      }
    });
  }

  function showCheckoutButton() {
    const button = document.querySelector('[data-checkout]');
    if (button) button.style.display = 'inline-flex';
  }

  document.querySelectorAll('[data-checkout]').forEach(button => {
    button.addEventListener('click', () => {
      if (!getCart().length) return;
      button.disabled = true;
      button.style.opacity = '.6';
      const msg = document.querySelector('[data-checkout-msg]');
      if (msg) msg.textContent = 'Taking you to secure checkout…';
      window.location.href = '/checkout/';
    });
  });

  async function loadRecommended() {
    const grid = document.querySelector('[data-rec-grid]');
    if (!grid) return;
    const products = await loadCatalog();
    const cartIds = new Set(getCart().map(item => String(item.id)));
    const recommended = products.filter(product => !cartIds.has(String(product.id))).slice(0, 3);

    grid.innerHTML = recommended.map(product => {
      const id = product.id || product.sku || '';
      const slug = product.slug;
      const price = Number(product.price || 0);
      return `
      <article data-rcard="" data-product-id="${escapeHtml(id)}" style="display: flex; flex-direction: column; background: #F5F2EA; transition: transform .6s cubic-bezier(.22,1,.36,1), box-shadow .6s ease;">
        <a href="/palettes/${escapeHtml(slug)}/" style="display: block; text-decoration: none; color: inherit;">
          <div data-rmedia style="position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #E3DED3;">
            <img src="${escapeHtml(normalizeImageUrl(Array.isArray(product.images) ? product.images[0] : null))}" alt="${escapeHtml(product.title || 'Product')}" loading="lazy" style="width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .8s cubic-bezier(.22,1,.36,1);" />
          </div>
        </a>
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 18px 20px 22px;">
          <a href="/palettes/${escapeHtml(slug)}/" style="text-decoration: none; color: inherit;">
            <p style="margin: 0 0 5px; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #A9A29A;">${escapeHtml(product.category || 'Product')}</p>
            <h3 data-rtitle style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(19px, 1.7vw, 26px); line-height: 1; transition: transform .4s cubic-bezier(.22,1,.36,1);">${escapeHtml(product.title || 'Product')}</h3>
          </a>
          ${swatchStripHTML(getSwatches(product.title))}
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 2px;">
            <p style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 19px;">${formatPrice(price)}</p>
            <button type="button" data-rec-add style="padding: 10px 16px; border: 1px solid #292825; border-radius: 999px; background: transparent; font-size: 10.5px; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; transition: background .3s ease, color .3s ease, transform .3s ease;">Add to Cart</button>
          </div>
        </div>
      </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-rcard]').forEach(card => {
      const media = card.querySelector('[data-rmedia] img');
      const swatchStrip = card.querySelector('[data-swatch-strip]');
      const title = card.querySelector('[data-rtitle]');
      const addBtn = card.querySelector('[data-rec-add]');

      if (!REDUCED) {
        card.addEventListener('pointerenter', () => {
          card.style.transform = 'translateY(-7px)';
          card.style.boxShadow = '0 26px 46px rgba(41,40,37,.13)';
          if (media) media.style.transform = 'scale(1.06)';
          if (title) title.style.transform = 'translateX(3px)';
          animateSwatches(swatchStrip, true);
          if (addBtn) { addBtn.style.background = '#292825'; addBtn.style.color = '#F5F2EA'; }
        });
        card.addEventListener('pointerleave', () => {
          card.style.transform = 'none';
          card.style.boxShadow = 'none';
          if (media) media.style.transform = 'none';
          if (title) title.style.transform = 'none';
          animateSwatches(swatchStrip, false);
          if (addBtn) { addBtn.style.background = 'transparent'; addBtn.style.color = '#292825'; }
        });
      }

      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          const id = card.getAttribute('data-product-id');
          const product = recommended.find(p => String(p.id || p.sku || '') === id);
          if (!product) return;
          try {
            await addItem(product);
            showToast('Added to your cart');
          } catch (error) {
            reportError(error);
          }
        });
      }
    });
  }

  onCartChange(renderCart);
  onCartChange(loadRecommended);
  // The catalogue supplies brands and recommendations; the cart supplies rows.
  loadCatalog().then(() => refresh()).catch(reportError);
