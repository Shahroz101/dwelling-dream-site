  import { addItem, syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';
  // Only the accordion, progress bar and magnetic buttons - not
  // initDwellingDream(), which would bind its own gallery and cart handlers on
  // top of the ones below (see the design page for the history).
  import { initAccordions, initScrollProgress, initMagnetic } from '<?php echo DD_URI; ?>/js/interactions.js';

  (function () {
    // WooCommerce renders the product into the page; this is the same record
    // the catalogue endpoint would return for it.
    const currentProduct = <?php echo dd_product_json($dd); ?>;
    const symbol = <?php echo wp_json_encode(dd_currency_symbol()); ?>;
    const priceText = `${symbol}${Number(currentProduct.price || 0).toFixed(2)}`;

    const setText = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = value || '';
    };

    // --- Gallery: crossfading views, thumbnails, arrows, swipe.
    (function initGallery() {
      const mediaWrap = document.querySelector('[data-main-media]');
      const thumbsWrap = document.querySelector('[role="tablist"][aria-label="Product images"]');
      if (!mediaWrap || !thumbsWrap) return;
      const views = Array.from(mediaWrap.querySelectorAll('[data-view]'));
      const thumbs = Array.from(thumbsWrap.querySelectorAll('[data-thumb]'));
      if (!views.length) return;
      let current = 0;

      const show = i => {
        current = ((i % views.length) + views.length) % views.length;
        views.forEach((view, j) => {
          const active = j === current;
          view.style.opacity = active ? '1' : '0';
          view.style.pointerEvents = active ? 'auto' : 'none';
        });
        thumbs.forEach((thumb, j) => {
          const active = j === current;
          thumb.setAttribute('aria-selected', active ? 'true' : 'false');
          thumb.style.borderColor = active ? '#292825' : '#D8D2C8';
          thumb.style.opacity = active ? '1' : '.72';
          if (active) thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        });
      };

      thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => show(i)));
      const prevBtn = mediaWrap.querySelector('[data-slide-prev]');
      const nextBtn = mediaWrap.querySelector('[data-slide-next]');
      if (prevBtn) prevBtn.addEventListener('click', () => show(current - 1));
      if (nextBtn) nextBtn.addEventListener('click', () => show(current + 1));

      let touchStartX = null;
      mediaWrap.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
      mediaWrap.addEventListener('touchend', e => {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
        touchStartX = null;
      }, { passive: true });
    })();

    // --- Add to cart.
    const addMessage = document.querySelector('[data-added]');
    document.querySelectorAll('[data-add]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        if (addMessage) addMessage.textContent = 'Adding…';
        try {
          await addItem(currentProduct);
          if (addMessage) addMessage.textContent = 'Added to cart';
        } catch (error) {
          if (addMessage) addMessage.textContent = error.message || 'Could not add to cart';
        } finally {
          button.disabled = false;
        }
      });
    });

    // --- Buy now: add this palette and go straight to checkout.
    let buyNowInFlight = false;
    const buyNowModal = document.querySelector('[data-buy-now-modal]');
    const buyNowMsgEl = document.querySelector('[data-buy-now-msg]');

    function showBuyNowMessage(text, { retry = false } = {}) {
      if (!buyNowMsgEl) return;
      if (!retry) { buyNowMsgEl.textContent = text; return; }
      buyNowMsgEl.innerHTML = '';
      buyNowMsgEl.append(text + ' ');
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.textContent = 'Try again';
      retryBtn.style.cssText = 'border:0; background:none; padding:0; font:inherit; color:#292825; text-decoration:underline; cursor:pointer;';
      retryBtn.addEventListener('click', () => { showBuyNowMessage(''); startBuyNow(); });
      buyNowMsgEl.append(retryBtn);
    }

    function closeBuyNowModal() {
      if (buyNowModal) buyNowModal.style.display = 'none';
    }

    function openBuyNowModal() {
      if (!buyNowModal) return;
      setText('[data-buy-now-title]', currentProduct.title || 'Product');
      setText('[data-buy-now-price]', priceText);
      showBuyNowMessage('');
      const go = document.querySelector('[data-buy-now-go]');
      if (go) { go.disabled = false; go.style.opacity = '1'; }
      buyNowModal.style.display = 'flex';
    }

    async function startBuyNow() {
      if (buyNowInFlight) return;
      const go = document.querySelector('[data-buy-now-go]');
      buyNowInFlight = true;
      if (go) { go.disabled = true; go.style.opacity = '.6'; }
      showBuyNowMessage('Taking you to secure checkout…');
      try {
        await addItem(currentProduct);
        window.location.href = '/checkout/';
      } catch (error) {
        showBuyNowMessage(error.message || 'Could not start checkout.', { retry: true });
        buyNowInFlight = false;
        if (go) { go.disabled = false; go.style.opacity = '1'; }
      }
    }

    document.querySelectorAll('[data-buy-now-go]').forEach(button => button.addEventListener('click', startBuyNow));
    document.querySelectorAll('[data-buy-now]').forEach(button => button.addEventListener('click', openBuyNowModal));
    const buyNowClose = document.querySelector('[data-buy-now-close]');
    const buyNowBackdrop = document.querySelector('[data-buy-now-backdrop]');
    if (buyNowClose) buyNowClose.addEventListener('click', closeBuyNowModal);
    if (buyNowBackdrop) buyNowBackdrop.addEventListener('click', closeBuyNowModal);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && buyNowModal && buyNowModal.style.display !== 'none') closeBuyNowModal();
    });

    // --- Customer reviews (shop-wide, from the Etsy shop; labelled as such).
    const REVIEWS_SHOWN = 6;
    const escapeHtml = value => String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const stars = rating => {
      const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
      return '<span aria-hidden="true" style="letter-spacing:2px;color:#8A7F6C;">' +
        '★'.repeat(n) + '<span style="color:#D8D2C8;">' + '★'.repeat(5 - n) + '</span></span>' +
        '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">' + n + ' out of 5 stars</span>';
    };

    const formatDate = iso => {
      const d = new Date(iso + 'T00:00:00');
      return Number.isNaN(d.getTime()) ? '' :
        d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    };

    const reviewCard = review => `
      <article style="position:relative;display:flex;flex-direction:column;gap:10px;padding:22px 24px;background:#EDEAE0;border-radius:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          ${stars(review.rating)}
          <span style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8A837A;">${escapeHtml(formatDate(review.date))}</span>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.75;color:#4A4741;">${escapeHtml(review.message)}</p>
        <p style="margin:auto 0 0;font-size:12px;letter-spacing:.06em;color:#78736E;">${escapeHtml(review.reviewer)}</p>
      </article>`;

    async function loadReviews() {
      const section = document.querySelector('[data-reviews-section]');
      const grid = document.querySelector('[data-rev-grid]');
      const summary = document.querySelector('[data-rev-summary]');
      const more = document.querySelector('[data-rev-more]');
      if (!section || !grid) return;

      let data;
      try {
        const response = await fetch('/wp-json/dd/v1/reviews');
        data = await response.json();
      } catch (error) {
        return;
      }

      const reviews = Array.isArray(data && data.reviews) ? data.reviews : [];
      if (!reviews.length) return;

      summary.textContent =
        `${data.average} out of 5 from ${data.count} review${data.count === 1 ? '' : 's'} of Dwelling Dream palettes, brought over from our Etsy shop.`;

      let expanded = false;
      const render = () => {
        const visible = expanded ? reviews : reviews.slice(0, REVIEWS_SHOWN);
        grid.innerHTML = visible.map(reviewCard).join('');
        more.hidden = reviews.length <= REVIEWS_SHOWN;
        more.textContent = expanded ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`;
      };
      more.addEventListener('click', () => { expanded = !expanded; render(); });
      render();
      section.hidden = false;
    }

    syncCartBadge(document);
    initAccordions(document, { maxHeight: 900 });
    initScrollProgress(document);
    initMagnetic(document);
    loadReviews();
  })();
