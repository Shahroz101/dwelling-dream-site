<?php
// Generated from "Dwelling Dream Shipping Policy.dc.html" by scripts/build-wp-theme.js - edit the
// design page and rebuild rather than editing this file.
if (!defined('ABSPATH')) exit;
dd_page_head(array(
  'title' => 'Shipping Policy — Dwelling Dream',
  'description' => 'Dwelling Dream shipping policy. Every product is a digital download delivered by email; nothing is posted, so there are no shipping costs, destinations or delays.',
  'style' => <<<'CSS'
html { scroll-behavior: smooth; }
  body { margin: 0; background: #F5F2EA; color: #292825; font-family: Manrope, system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  * { box-sizing: border-box; }
  a { color: #292825; text-decoration: none; }
  a:hover { color: #817A6E; }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid #817A6E; outline-offset: 3px; }
  ::selection { background: #DFD3C3; }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { animation: none !important; } }
  /* Grid and flex children default to min-width:auto, so they refuse to shrink
     below their content's intrinsic width. One wide child - the product
     thumbnail strip is 11 x 56px - therefore forces its whole column wider
     than the phone screen, and every sibling in that column (hero image,
     description, price, buttons) gets clipped off the right edge. Allowing
     them to shrink lets the scroll container scroll instead. No effect on
     wider screens, where the content already fits. */
  [data-foot-grid] > *,
  [data-lic-grid] > * { min-width: 0; }
  @media (max-width: 860px) {
    nav[aria-label="Primary"] { gap: 10px !important; }
    nav[aria-label="Primary"] > a:not([data-cart]) { display: none !important; }
    nav[aria-label="Primary"] [data-mobile-menu] { display: inline-block !important; }
    [data-mobile-menu] summary::-webkit-details-marker { display: none; }
    [data-two] { grid-template-columns: 1fr !important; }
    [data-sticky] { position: static !important; }
    [data-lic-grid] { grid-template-columns: 1fr !important; }
    [data-foot-grid] { grid-template-columns: 1fr !important; gap: 32px !important; }
  }
CSS
));
get_header();
?>
<main id="top">
    <section aria-labelledby="p-h" style="padding: clamp(120px, 17vh, 200px) clamp(18px, 3.4vw, 54px) clamp(30px, 5vh, 54px);">
      <nav aria-label="Breadcrumb" style="margin-bottom: clamp(20px, 3vh, 30px); font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #A9A29A;">
        <a href="/" style="color: #A9A29A;" style-hover="color: #292825;">Home</a>
        <span aria-hidden="true" style="padding: 0 8px;">/</span>
        <a href="/help/" style="color: #A9A29A;" style-hover="color: #292825;">Help</a>
        <span aria-hidden="true" style="padding: 0 8px;">/</span>
        <span style="color: #292825;">Shipping Policy</span>
      </nav>
      <p style="margin: 0 0 20px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Shipping Policy</p>
      <h1 id="p-h" style="margin: 0 0 24px; max-width: 20ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(40px, 6.2vw, 96px); line-height: .98; letter-spacing: -.015em;">Nothing is <em style="font-style: italic; font-weight: 400;">shipped.</em></h1>
      <p style="margin: 0; max-width: 56ch; font-size: clamp(15px, 1.15vw, 18px); line-height: 1.7; color: #5F5A54;">Every Dwelling Dream product is a digital download. There is no parcel, no carrier and no delivery address &mdash; which means no shipping cost, no shipping destinations to choose between, and nothing that can be delayed or lost in transit.</p>
    </section>

    <section aria-label="Shipping policy" style="padding: clamp(40px, 6vh, 80px) clamp(18px, 3.4vw, 54px) clamp(56px, 9vh, 100px); background: #EDEAE0;">
      <div style="display: flex; flex-direction: column; gap: 26px; max-width: 64ch;">
        <div>
          <h2 style="margin: 0 0 10px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(22px, 2.2vw, 30px);">Shipping cost</h2>
          <p style="margin: 0; font-size: 15px; line-height: 1.85; color: #5F5A54;">None, ever. No physical goods are sent, so no shipping, handling or customs charge is applied to any order, anywhere in the world. The price shown on a palette page is the full amount you pay.</p>
        </div>
        <div>
          <h2 style="margin: 0 0 10px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(22px, 2.2vw, 30px);">Where we deliver</h2>
          <p style="margin: 0; font-size: 15px; line-height: 1.85; color: #5F5A54;">Everywhere. Delivery is by email and by download link, so there are no excluded countries or regions, and no address is collected at checkout.</p>
        </div>
        <div>
          <h2 style="margin: 0 0 10px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(22px, 2.2vw, 30px);">Delivery time</h2>
          <p style="margin: 0; font-size: 15px; line-height: 1.85; color: #5F5A54;">Immediate. The moment your payment clears you are taken to your download page, and a confirmation email with the same link is sent to the address you enter at checkout. If it has not arrived within five minutes, check your spam folder before writing to us.</p>
        </div>
        <div>
          <h2 style="margin: 0 0 10px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(22px, 2.2vw, 30px);">If delivery fails</h2>
          <p style="margin: 0; font-size: 15px; line-height: 1.85; color: #5F5A54;">Your download link stays active, and the confirmation email keeps a copy of it. If the email never arrives, a file will not open, or a link stops working, write to <a href="/contact/" style="text-decoration: underline; text-underline-offset: 3px;">contact@dwellingdream.shop</a> with the email address you paid with and we will resend it. See the <a href="/help/return-policy/" style="text-decoration: underline; text-underline-offset: 3px;">return policy</a> for refunds.</p>
        </div>
      </div>
    </section>

    <section style="padding: 0 clamp(18px, 3.4vw, 54px) clamp(64px, 10vh, 120px);">
      <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #5F5A54; max-width: 62ch;">Questions this page does not answer? Write to <a href="/contact/" style="text-decoration: underline; text-underline-offset: 3px;">contact@dwellingdream.shop</a> or use the <a href="/contact/" style="text-decoration: underline; text-underline-offset: 3px;">contact form</a> &mdash; we reply within one working day. You can also return to the <a href="/help/" style="text-decoration: underline; text-underline-offset: 3px;">help centre</a>.</p>
    </section>
    
  </main>
<script type="module">
import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';

  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);
</script>
<?php get_footer(); ?>