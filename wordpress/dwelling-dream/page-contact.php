<?php
// Generated from "Dwelling Dream Contact.dc.html" by scripts/build-wp-theme.js - edit the
// design page and rebuild rather than editing this file.
if (!defined('ABSPATH')) exit;
dd_page_head(array(
  'title' => 'Contact — Dwelling Dream',
  'description' => 'Contact Dwelling Dream — questions about a palette, a download or an order. Real replies, usually within a day.',
  'style' => <<<'CSS'
html { scroll-behavior: smooth; }
  body { margin: 0; background: #F5F2EA; color: #292825; font-family: Manrope, system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  * { box-sizing: border-box; }
  a { color: #292825; text-decoration: none; }
  a:hover { color: #817A6E; }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid #817A6E; outline-offset: 3px; }
  ::selection { background: #DFD3C3; }
  @keyframes dd-float { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-12px) rotate(var(--r,0deg)); } }
  @keyframes dd-drip { 0% { transform: scaleY(.34); } 100% { transform: scaleY(1); } }
  @keyframes dd-bead { 0%, 68% { transform: translateY(0) scale(.6); opacity: 0; } 82% { transform: translateY(6px) scale(1); opacity: 1; } 100% { transform: translateY(26px) scale(.55); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { animation: none !important; } }
  /* Grid and flex children default to min-width:auto, so they refuse to shrink
     below their content's intrinsic width. One wide child - the product
     thumbnail strip is 11 x 56px - therefore forces its whole column wider
     than the phone screen, and every sibling in that column (hero image,
     description, price, buttons) gets clipped off the right edge. Allowing
     them to shrink lets the scroll container scroll instead. No effect on
     wider screens, where the content already fits. */
  [data-foot-grid] > *,
  [data-hero-grid] > *,
  [data-story-grid] > * { min-width: 0; }
  @media (max-width: 860px) {
    nav[aria-label="Primary"] { gap: 10px !important; }
    nav[aria-label="Primary"] > a:not([data-cart]) { display: none !important; }
    nav[aria-label="Primary"] [data-mobile-menu] { display: inline-block !important; }
    [data-mobile-menu] summary::-webkit-details-marker { display: none; }
    [data-hero-grid] { grid-template-columns: 1fr !important; }
    [data-story-grid] { grid-template-columns: 1fr !important; }
    [data-story-grid] [data-reveal] { position: static !important; }
    [data-beliefs] { grid-template-columns: 1fr !important; }
    [data-foot-grid] { grid-template-columns: 1fr !important; gap: 32px !important; }
  }
CSS
));
get_header();
?>
<main id="top">

    <section aria-labelledby="c-h" style="padding: clamp(120px, 17vh, 200px) clamp(18px, 3.4vw, 54px) clamp(30px, 5vh, 54px);">
      <p style="margin: 0 0 20px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Contact</p>
      <h1 id="c-h" style="margin: 0 0 24px; max-width: 20ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(40px, 6.2vw, 112px); line-height: .95; letter-spacing: -.015em;">Ask us <em style="font-style: italic; font-weight: 400;">anything.</em></h1>
      <p style="margin: 0; max-width: 56ch; font-size: clamp(15px, 1.15vw, 18px); line-height: 1.7; color: #5F5A54;">A question about a palette, a download that will not open, or an order that needs fixing — write to us and a human replies, usually within a day.</p>
    </section>

    <section aria-label="Contact form" style="padding: 0 clamp(18px, 3.4vw, 54px) clamp(70px, 11vh, 130px);">
      <div data-contact-grid="" style="display: grid; gap: clamp(28px, 4vw, 64px); grid-template-columns: 1fr; max-width: 1180px; margin: 0 auto; padding-top: clamp(24px, 4vh, 40px); border-top: 1px solid #D8D2C8;">

        <form data-contact-form="" novalidate="" style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label for="dd-name" style="display:block; margin:0 0 8px; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:#78736E;">Your name</label>
            <input id="dd-name" name="name" type="text" required="" autocomplete="name" maxlength="120" style="width:100%; padding:15px 18px; border:1px solid #D8D2C8; border-radius:10px; background:#FFFDF8; color:#292825; font-family:inherit; font-size:15px; transition:border-color .3s ease;" />
          </div>
          <div>
            <label for="dd-email" style="display:block; margin:0 0 8px; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:#78736E;">Email address</label>
            <input id="dd-email" name="email" type="email" required="" autocomplete="email" maxlength="254" style="width:100%; padding:15px 18px; border:1px solid #D8D2C8; border-radius:10px; background:#FFFDF8; color:#292825; font-family:inherit; font-size:15px; transition:border-color .3s ease;" />
            <p style="margin: 8px 0 0; font-size: 12px; color: #8A837A;">If you are writing about an order, use the email you paid with.</p>
          </div>
          <div>
            <label for="dd-message" style="display:block; margin:0 0 8px; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:#78736E;">Message</label>
            <textarea id="dd-message" name="message" required="" rows="7" maxlength="5000" style="width:100%; padding:15px 18px; border:1px solid #D8D2C8; border-radius:10px; background:#FFFDF8; color:#292825; font-family:inherit; font-size:15px; transition:border-color .3s ease; resize: vertical; min-height: 160px; line-height: 1.6;"></textarea>
          </div>

          <!-- Honeypot. Hidden from people, irresistible to bots; the server
               silently discards any submission that fills it in. -->
          <div aria-hidden="true" style="position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;">
            <label for="dd-website">Leave this field empty</label>
            <input id="dd-website" name="website" type="text" tabindex="-1" autocomplete="off" />
          </div>

          <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap;">
            <button data-contact-submit="" type="submit" style="display: inline-flex; align-items: center; padding: 17px 34px; border: 0; border-radius: 999px; background: #292825; color: #F5F2EA; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; transition: background .35s ease;" style-hover="background: #47443E;">Send message</button>
            <p data-contact-status="" role="status" aria-live="polite" style="margin: 0; font-size: 14px; line-height: 1.6; color: #5F5A54;"></p>
          </div>
        </form>

        <aside style="align-self: start; padding: clamp(24px, 3vw, 34px); background: #EDEAE0; border-radius: 14px;">
          <h2 style="margin: 0 0 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(24px, 2.4vw, 34px); line-height: 1.1;">Or write to us directly</h2>
          <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.7; color: #5F5A54;">
            <a href="mailto:contact@dwellingdream.shop" style="text-decoration: underline; text-underline-offset: 3px;">contact@dwellingdream.shop</a>
          </p>
          <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.7; color: #5F5A54;">
            <a href="tel:+353874794572" style="text-decoration: underline; text-underline-offset: 3px;">+353 87 479 4572</a>
          </p>
          <address style="margin: 0 0 8px; font-style: normal; font-size: 15px; line-height: 1.7; color: #5F5A54;">Dwelling Dream<br>56 Innovation Square<br>Tallaght, Dublin 24<br>Ireland</address>
          <p style="margin: 0 0 22px; font-size: 13px; line-height: 1.7; color: #78736E;">Real replies, usually within a day. No ticket numbers.</p>

          <h3 style="margin: 0 0 10px; font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: #78736E;">Before you write</h3>
          <p style="margin: 0 0 8px; font-size: 14px; line-height: 1.7; color: #5F5A54;">Lost your download link? We can resend it — include the email you paid with.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #5F5A54;">Most questions are already answered in the <a href="/help#faq" style="text-decoration: underline; text-underline-offset: 3px;">FAQ</a>, and our <a href="/help/return-policy/" style="text-decoration: underline; text-underline-offset: 3px;">refund policy</a> covers files that will not open.</p>
        </aside>

      </div>
    </section>

    
  </main>
<script type="module">
import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';

  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);

  // Two columns once there is room for them; one column on phones.
  const grid = document.querySelector('[data-contact-grid]');
  const layout = () => { if (grid) grid.style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : '1.35fr .65fr'; };
  window.addEventListener('resize', layout);
  layout();

  const form = document.querySelector('[data-contact-form]');
  const status = document.querySelector('[data-contact-status]');
  const submit = document.querySelector('[data-contact-submit]');

  if (form) {
    const say = (text, tone) => {
      status.textContent = text;
      status.style.color = tone === 'error' ? '#8C3A2B' : (tone === 'ok' ? '#3E6B4F' : '#5F5A54');
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim(),
        website: form.website.value
      };

      if (!payload.name || !payload.email || !payload.message) {
        say('Please fill in your name, email and message.', 'error');
        return;
      }

      submit.disabled = true;
      submit.style.opacity = '.6';
      say('Sending…');

      try {
        const response = await fetch('/wp-json/dd/v1/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success) {
          form.reset();
          say(result.message || 'Thanks - your message is on its way.', 'ok');
        } else {
          // The server explains itself (rate limit, bad address, SMTP down),
          // so prefer its wording over a generic failure.
          say(result.message || 'Something went wrong. Please email contact@dwellingdream.shop directly.', 'error');
        }
      } catch (error) {
        say('We could not reach the server. Please email contact@dwellingdream.shop directly.', 'error');
      } finally {
        submit.disabled = false;
        submit.style.opacity = '1';
      }
    });
  }
</script>
<?php get_footer(); ?>