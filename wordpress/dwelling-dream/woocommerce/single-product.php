<?php
// Generated from "Dwelling Dream Product.dc.html" by scripts/build-wp-theme.js - edit the
// design page and rebuild rather than editing this file.
if (!defined('ABSPATH')) exit;
$dd = dd_product_view(wc_get_product(get_queried_object_id()));
dd_page_head(array(
  'title' => $dd['title'] . ' — Dwelling Dream',
  'description' => $dd['title'] . ($dd['category'] ? ' by ' . $dd['category'] : '') . '. ' . $dd['description'],
  'style' => <<<'CSS'
html { scroll-behavior: smooth; }
  body { margin: 0; background: #F5F2EA; color: #292825; font-family: Manrope, system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  * { box-sizing: border-box; }
  a { color: #292825; text-decoration: none; }
  a:hover { color: #817A6E; }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid #817A6E; outline-offset: 3px; }
  ::selection { background: #DFD3C3; }
  [role="tablist"][aria-label="Product images"]::-webkit-scrollbar { display: none; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { animation: none !important; } }
  /* Grid and flex children default to min-width:auto, so they refuse to shrink
     below their content's intrinsic width. One wide child - the product
     thumbnail strip is 11 x 56px - therefore forces its whole column wider
     than the phone screen, and every sibling in that column (hero image,
     description, price, buttons) gets clipped off the right edge. Allowing
     them to shrink lets the scroll container scroll instead. No effect on
     wider screens, where the content already fits. */
  [data-foot-grid] > *,
  [data-inc-grid] > *,
  [data-rec-grid] > *,
  [data-top-grid] > * { min-width: 0; }
  @media (max-width: 860px) {
    nav[aria-label="Primary"] { gap: 10px !important; }
    nav[aria-label="Primary"] > a:not([data-cart]) { display: none !important; }
    nav[aria-label="Primary"] [data-mobile-menu] { display: inline-block !important; }
    [data-mobile-menu] summary::-webkit-details-marker { display: none; }
    [data-top-grid] { grid-template-columns: 1fr !important; }
    [data-inc-grid] { grid-template-columns: 1fr !important; }
    [data-foot-grid] { grid-template-columns: 1fr !important; gap: 32px !important; }
  }
CSS
));
get_header();
?>
<main id="top">

    <section aria-labelledby="p-h" style="padding: clamp(104px, 14vh, 160px) clamp(18px, 3.4vw, 54px) clamp(56px, 9vh, 100px);">
      <nav aria-label="Breadcrumb" style="margin-bottom: clamp(22px, 3vh, 34px); font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #A9A29A;">
        <a href="/" style="color: #A9A29A;" style-hover="color: #292825;">Home</a>
        <span aria-hidden="true" style="padding: 0 8px;">/</span>
        <a href="/palettes/" style="color: #A9A29A;" style-hover="color: #292825;">Palettes</a>
        <span aria-hidden="true" style="padding: 0 8px;">/</span>
        <span data-product-breadcrumb style="color: #292825;"><?php echo esc_html($dd['title']); ?></span>
      </nav>

      <div data-top-grid="" style="display: grid; grid-template-columns: 1.15fr 1fr; gap: clamp(28px, 4.5vw, 76px); align-items: start;">

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <?php dd_product_gallery($dd); ?>
        </div>

        <div style="display: flex; flex-direction: column; gap: clamp(18px, 2.8vh, 30px);">
          <p data-product-brand style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;"><?php echo esc_html($dd['category']); ?></p>
          <h1 id="p-h" style="margin: 4px 0 6px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(38px, 5vw, 86px); line-height: 1.02; letter-spacing: -.01em;"><?php echo esc_html($dd['title']); ?></h1>
          <p data-product-summary style="margin: 0 0 6px; max-width: 46ch; font-size: clamp(15px, 1.1vw, 17.5px); line-height: 1.85; color: #5F5A54;"><?php echo esc_html($dd['description']); ?></p>

          <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
            <p data-product-price style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(30px, 3vw, 46px); line-height: 1;"><?php echo esc_html($dd['price_text']); ?></p>
          </div>
          <p style="margin: 0; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #78736E;">4.9/5 · 1,000+ homes painted</p>

          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-top: 6px;">
            <button data-add="" data-magnetic="" style="display: inline-flex; align-items: center; padding: 18px 34px; border: 0; border-radius: 999px; background: #292825; color: #F5F2EA; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; box-shadow: 0 18px 34px rgba(41,40,37,.16); transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #3F3D37; color: #F5F2EA;">Add to cart — <?php echo esc_html($dd['price_text']); ?></button>
            <button data-buy-now="" data-magnetic="" style="display: inline-flex; align-items: center; padding: 18px 30px; border: 1px solid #D8D2C8; border-radius: 999px; background: transparent; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #EDEAE0;">Buy now</button>
          </div>
          <p data-added="" role="status" aria-live="polite" style="margin: 0; min-height: 16px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #78736E;"></p>

          <ul style="display: flex; flex-direction: column; gap: 0; margin: 8px 0 0; padding: 0; list-style: none; border-top: 1px solid #D8D2C8;">
            <li style="padding: 13px 0; border-bottom: 1px solid #D8D2C8; font-size: 13px; line-height: 1.6; color: #4E4A44;">Nine curated colors with hex codes and LRV values</li>
            <li style="padding: 13px 0; border-bottom: 1px solid #D8D2C8; font-size: 13px; line-height: 1.6; color: #4E4A44;">Two tested pairings for every color</li>
            <li style="padding: 13px 0; border-bottom: 1px solid #D8D2C8; font-size: 13px; line-height: 1.6; color: #4E4A44;">Real-room photography for each shade</li>
            <li style="padding: 13px 0; border-bottom: 1px solid #D8D2C8; font-size: 13px; line-height: 1.6; color: #4E4A44;">Placement guidance — walls, trim, cabinetry, accents</li>
            <li style="padding: 13px 0; border-bottom: 1px solid #D8D2C8; font-size: 13px; line-height: 1.6; color: #4E4A44;">100+ page PDF · instant download · no physical product shipped</li>
          </ul>
          <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.65; color: #78736E;">Dwelling Dream is an independent studio and is not affiliated with, endorsed by or sponsored by any paint manufacturer. Brand and color names identify the paint colors the palette uses; all trademarks remain the property of their owners.</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="inc-h" style="padding: clamp(64px, 10vh, 130px) clamp(18px, 3.4vw, 54px);">
      <div data-inc-grid="" style="display: grid; grid-template-columns: 0.85fr 1.15fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div>
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">What's included</p>
          <h2 id="inc-h" style="margin: 0 0 18px; max-width: 16ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">Everything you need to <em style="font-style: italic;">decide.</em></h2>
          <p style="margin: 0; max-width: 40ch; font-size: 14px; line-height: 1.75; color: #78736E;">Delivered as PDFs the moment you check out — read on any device, print the pages you want on the wall.</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0; border-top: 1px solid #D8D2C8;">
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="true" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(20px, 2vw, 30px);">Color Palette Guide · 50+ pages</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 300px; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 20px; max-width: 56ch; font-size: 14px; line-height: 1.8; color: #5F5A54;">The nine colors with hex codes and LRV values, detailed descriptions, where each shade belongs, room photography, and two curated combinations for every color.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(20px, 2vw, 30px);">Complete Paint Guide · 30+ pages</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 20px; max-width: 56ch; font-size: 14px; line-height: 1.8; color: #5F5A54;">Paint fundamentals, interior paint types, sheen and durability, how light and room direction change a color, understanding LRV, accent wall guidance, and how much paint to buy.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(20px, 2vw, 30px);">Paint Project Planner</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 20px; max-width: 56ch; font-size: 14px; line-height: 1.8; color: #5F5A54;">Sampling planner, room tracking sheets, color comparison pages, a wall test tracker for morning, afternoon and night, quantity calculator, measurements and a final decision page.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(20px, 2vw, 30px);">Delivery &amp; refunds</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 20px; max-width: 56ch; font-size: 14px; line-height: 1.8; color: #5F5A54;">Files arrive by email immediately after checkout and stay available in your account. Because these are instant downloads, purchases aren't refundable — write to us if anything is wrong and we'll make it right. Prices are in US dollars and include any applicable tax.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="rev-h" data-reviews-section="" hidden="" style="padding: clamp(64px, 10vh, 130px) clamp(18px, 3.4vw, 54px);">
      <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; flex-wrap: wrap; margin-bottom: clamp(24px, 3.5vh, 40px);">
        <div style="max-width: 620px;">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Reviews</p>
          <h2 id="rev-h" style="margin: 0 0 14px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(28px, 3.8vw, 60px); line-height: 1;">What customers <em style="font-style: italic; font-weight: 400;">say.</em></h2>
          <p data-rev-summary="" style="margin: 0; font-size: 14px; line-height: 1.7; color: #5F5A54;"></p>
        </div>
      </div>

      <div data-rev-grid="" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: clamp(14px, 1.6vw, 22px);"></div>

      <div style="margin-top: clamp(20px, 3vh, 32px);">
        <button data-rev-more="" hidden="" style="display: inline-flex; align-items: center; padding: 13px 26px; border: 1px solid #D8D2C8; border-radius: 999px; background: transparent; color: #292825; font-size: 11px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; cursor: pointer; transition: background .3s ease;" style-hover="background: #EDEAE0;">Show all reviews</button>
      </div>
    </section>

    <section aria-labelledby="rec-h" style="padding: clamp(64px, 10vh, 130px) clamp(18px, 3.4vw, 54px); background: #EDEAE0;">
      <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; flex-wrap: wrap; margin-bottom: clamp(28px, 4vh, 48px);">
        <div style="max-width: 560px;">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Recommended</p>
          <h2 id="rec-h" style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(28px, 3.8vw, 60px); line-height: 1;">Pairs beautifully <em style="font-style: italic;">with these.</em></h2>
        </div>
        <a data-magnetic="" href="/palettes/" style="font-size: 11px; letter-spacing: .2em; text-transform: uppercase; border-bottom: 1px solid #D8D2C8; padding-bottom: 4px; transition: transform .45s cubic-bezier(.22,1,.36,1), color .3s ease;">All palettes →</a>
      </div>

      <div data-rec-grid="" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 320px)); justify-content: start; gap: clamp(16px, 2vw, 30px);">
        <?php dd_product_recommended($dd); ?>
      </div>
    </section>

    <section aria-labelledby="cta-h" style="padding: clamp(64px, 10vh, 130px) clamp(18px, 3.4vw, 54px); background: #292825; color: #F5F2EA; text-align: center;">
      <h2 id="cta-h" style="margin: 0 auto 18px; max-width: 22ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4.6vw, 76px); line-height: .98;">Nine colors. <em style="font-style: italic; font-weight: 400;">One afternoon.</em></h2>
      <p style="margin: 0 auto 30px; max-width: 48ch; font-size: clamp(14px, 1vw, 16px); line-height: 1.7; color: rgba(245,242,234,.84);">Add this palette to your cart and start with the wall you’ve been avoiding.</p>
      <button data-add="" data-magnetic="" style="display: inline-flex; align-items: center; padding: 19px 34px; border: 0; border-radius: 999px; background: #F5F2EA; color: #292825; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #DFD3C3; color: #292825;">Add to cart — <?php echo esc_html($dd['price_text']); ?></button>
    </section>

    <div data-buy-now-modal="" role="dialog" aria-modal="true" aria-label="Checkout" style="display: none; position: fixed; inset: 0; z-index: 200; align-items: center; justify-content: center; padding: 20px;">
      <div data-buy-now-backdrop="" style="position: absolute; inset: 0; background: rgba(41,40,37,.5);"></div>
      <div style="position: relative; width: 100%; max-width: 420px; padding: 30px 26px; background: #F5F2EA; border-radius: 4px; box-shadow: 0 30px 70px rgba(41,40,37,.3);">
        <button data-buy-now-close="" aria-label="Close checkout" style="position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border: 0; background: none; cursor: pointer; font-size: 18px; line-height: 1; color: #78736E;">✕</button>
        <p style="margin: 0 0 4px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #78736E;">Checkout</p>
        <h2 data-buy-now-title style="margin: 0 0 4px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(22px, 2.4vw, 30px); line-height: 1.1;"></h2>
        <p data-buy-now-price style="margin: 0 0 22px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px;"></p>
        <button data-buy-now-go="" type="button" style="display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 17px 28px; border: 0; border-radius: 999px; background: #292825; color: #F5F2EA; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; transition: background .35s ease, opacity .25s ease;" style-hover="background: #47443E;">Continue to secure checkout</button>
        <p data-buy-now-msg="" role="status" aria-live="polite" style="margin: 10px 0 0; min-height: 14px; font-size: 11px; letter-spacing: .08em; color: #78736E;"></p>
      </div>
    </div>

    
  </main>
<script type="module">
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
</script>
<?php get_footer(); ?>