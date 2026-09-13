<?php
// Generated from "Dwelling Dream Help.dc.html" by scripts/build-wp-theme.js - edit the
// design page and rebuild rather than editing this file.
if (!defined('ABSPATH')) exit;
dd_page_head(array(
  'title' => 'Help, FAQ &amp; Legal — Dwelling Dream',
  'description' => 'Dwelling Dream help centre — frequently asked questions, download help, terms of service, privacy policy, refunds and licensing.',
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

    <section aria-labelledby="h-h" style="padding: clamp(120px, 17vh, 200px) clamp(18px, 3.4vw, 54px) clamp(40px, 6vh, 66px);">
      <p style="margin: 0 0 20px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Help centre</p>
      <h1 id="h-h" style="margin: 0 0 24px; max-width: 22ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(40px, 6.2vw, 112px); line-height: .95; letter-spacing: -.015em;">Questions, answered <em style="font-style: italic; font-weight: 400;">plainly.</em></h1>
      <p style="margin: 0; max-width: 56ch; font-size: clamp(15px, 1.15vw, 18px); line-height: 1.7; color: #5F5A54;">Everything about buying, downloading and using Dwelling Dream palettes — plus the legal detail, written to be read.</p>
    </section>

    <section aria-label="Help contents" style="padding: 0 clamp(18px, 3.4vw, 54px) clamp(40px, 6vh, 70px);">
      <nav aria-label="Jump to section" style="display: flex; gap: 8px; flex-wrap: wrap; padding-top: clamp(20px, 3vh, 30px); border-top: 1px solid #D8D2C8;">
        <a href="#faq" style="padding: 10px 18px; border: 1px solid #D8D2C8; border-radius: 999px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; transition: background .3s ease;" style-hover="background: #EDEAE0; color: #292825;">FAQ</a>
        <a href="#downloads" style="padding: 10px 18px; border: 1px solid #D8D2C8; border-radius: 999px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; transition: background .3s ease;" style-hover="background: #EDEAE0; color: #292825;">How downloads work</a>
        <a href="/help/terms-of-service/" style="padding: 10px 18px; border: 1px solid #D8D2C8; border-radius: 999px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; transition: background .3s ease;" style-hover="background: #EDEAE0; color: #292825;">Terms</a>
        <a href="/help/privacy-policy/" style="padding: 10px 18px; border: 1px solid #D8D2C8; border-radius: 999px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; transition: background .3s ease;" style-hover="background: #EDEAE0; color: #292825;">Privacy</a>
        <a href="/help/return-policy/" style="padding: 10px 18px; border: 1px solid #D8D2C8; border-radius: 999px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; transition: background .3s ease;" style-hover="background: #EDEAE0; color: #292825;">Refunds</a>
        <a href="#licensing" style="padding: 10px 18px; border: 1px solid #D8D2C8; border-radius: 999px; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; transition: background .3s ease;" style-hover="background: #EDEAE0; color: #292825;">Licensing</a>
      </nav>
    </section>

    <section id="faq" aria-labelledby="faq-h" style="padding: clamp(56px, 9vh, 110px) clamp(18px, 3.4vw, 54px); background: #EDEAE0;">
      <div data-two="" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div data-sticky="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">01 — FAQ</p>
          <h2 id="faq-h" style="margin: 0; max-width: 14ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">Before you <em style="font-style: italic;">buy.</em></h2>
        </div>

        <div style="display: flex; flex-direction: column; border-top: 1px solid #D8D2C8;">
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="true" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(19px, 1.9vw, 28px); line-height: 1.2;">What exactly am I buying?</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 340px; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 22px; max-width: 60ch; font-size: 14px; line-height: 1.85; color: #5F5A54;">A digital bundle of PDF guides: the nine-color palette guide with hex codes, LRV values and two pairings per color, the Complete Paint Guide, and the Paint Project Planner. Nothing is shipped.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(19px, 1.9vw, 28px); line-height: 1.2;">Do I need to buy the paint from a specific brand?</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 22px; max-width: 60ch; font-size: 14px; line-height: 1.85; color: #5F5A54;">Each palette is built around one brand's colors so the undertones stay consistent, but every color includes its hex value — any paint counter can colour-match from that if you prefer a different supplier.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(19px, 1.9vw, 28px); line-height: 1.2;">Will these colors work in my house?</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 22px; max-width: 60ch; font-size: 14px; line-height: 1.85; color: #5F5A54;">Every palette is tested in rooms facing each direction, in daylight and lamplight. The guide tells you which shades suit north-facing rooms, which need strong light, and where each one belongs — walls, trim, cabinetry or accents. Always sample before committing.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(19px, 1.9vw, 28px); line-height: 1.2;">How many palettes do I need for one home?</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 22px; max-width: 60ch; font-size: 14px; line-height: 1.85; color: #5F5A54;">One. Nine colors is enough to carry a whole house — that's the point. People buy a second palette when they want a different mood for a separate space, like a studio or a rental.</p>
            </div>
          </div>
          <div data-acc="" style="border-bottom: 1px solid #D8D2C8;">
            <button data-acc-btn="" aria-expanded="false" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; padding: 22px 0; border: 0; background: none; text-align: left; cursor: pointer;">
              <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(19px, 1.9vw, 28px); line-height: 1.2;">Is this suitable if I'm not a designer?</span>
              <span data-acc-icon="" style="flex: 0 0 auto; font-size: 18px; transition: transform .45s cubic-bezier(.22,1,.36,1);">+</span>
            </button>
            <div data-acc-body="" style="overflow: hidden; max-height: 0; opacity: 0; transition: max-height .55s cubic-bezier(.22,1,.36,1), opacity .4s ease;">
              <p style="margin: 0 0 22px; max-width: 60ch; font-size: 14px; line-height: 1.85; color: #5F5A54;">It's written for exactly that. No jargon without explanation, and the planner walks you from sampling to final coat step by step.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="downloads" aria-labelledby="dl-h" style="padding: clamp(56px, 9vh, 110px) clamp(18px, 3.4vw, 54px);">
      <div data-two="" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div data-sticky="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">02 — Downloads</p>
          <h2 id="dl-h" style="margin: 0; max-width: 14ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">How delivery <em style="font-style: italic;">works.</em></h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: clamp(20px, 3vh, 30px); max-width: 62ch;">
          <p style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(20px, 2vw, 30px); line-height: 1.35;">Your files arrive the moment your payment clears — usually within a minute.</p>
          <ol style="display: flex; flex-direction: column; gap: 0; margin: 0; padding: 0; list-style: none; border-top: 1px solid #D8D2C8;">
            <li style="display: flex; gap: 18px; padding: 18px 0; border-bottom: 1px solid #D8D2C8;"><span style="flex: 0 0 auto; font-size: 11px; letter-spacing: .2em; color: #A9A29A;">01</span><span style="font-size: 14px; line-height: 1.75; color: #5F5A54;">Check out with any major card. No account required.</span></li>
            <li style="display: flex; gap: 18px; padding: 18px 0; border-bottom: 1px solid #D8D2C8;"><span style="flex: 0 0 auto; font-size: 11px; letter-spacing: .2em; color: #A9A29A;">02</span><span style="font-size: 14px; line-height: 1.75; color: #5F5A54;">A download link is emailed to the address you enter at checkout — check spam if it hasn't landed in five minutes.</span></li>
            <li style="display: flex; gap: 18px; padding: 18px 0; border-bottom: 1px solid #D8D2C8;"><span style="flex: 0 0 auto; font-size: 11px; letter-spacing: .2em; color: #A9A29A;">03</span><span style="font-size: 14px; line-height: 1.75; color: #5F5A54;">Files are PDFs. Read them on any phone, tablet or computer, and print the pages you want beside you while painting.</span></li>
            <li style="display: flex; gap: 18px; padding: 18px 0; border-bottom: 1px solid #D8D2C8;"><span style="flex: 0 0 auto; font-size: 11px; letter-spacing: .2em; color: #A9A29A;">04</span><span style="font-size: 14px; line-height: 1.75; color: #5F5A54;">Your link stays active, and the confirmation email keeps a copy. Lost both? Write to <a href="/contact/" style="text-decoration: underline; text-underline-offset: 3px;">contact@dwellingdream.shop</a> with your order email and we'll resend.</span></li>
          </ol>
        </div>
      </div>
    </section>

    <section id="terms" aria-labelledby="terms-h" style="padding: clamp(56px, 9vh, 110px) clamp(18px, 3.4vw, 54px); background: #EDEAE0;">
      <div data-two="" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div data-sticky="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">03 — Terms of service</p>
          <h2 id="terms-h" style="margin: 0; max-width: 14ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">The <em style="font-style: italic;">agreement.</em></h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: 24px; max-width: 62ch;">
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">By purchasing from Dwelling Dream you agree to these terms. We sell digital guides for personal use in your own home or your clients' homes, with the licensing limits set out below.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">Our palettes are design guidance, not a guarantee of outcome. Paint appearance varies with light, surface preparation, primer, sheen and the batch you buy, so always test samples on your own walls before committing to a full room. We aren't liable for the cost of paint, labour or rework arising from a color you decide against.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">Color names and codes are referenced to help you buy the right paint. Dwelling Dream is independent and not affiliated with, endorsed by or sponsored by any paint manufacturer; all brand names remain the property of their owners.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">We may update guides, prices or these terms. Changes apply going forward, never retroactively to a purchase you've already made.</p>
        </div>
      </div>
    </section>

    <section id="privacy" aria-labelledby="priv-h" style="padding: clamp(56px, 9vh, 110px) clamp(18px, 3.4vw, 54px);">
      <div data-two="" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div data-sticky="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">04 — Privacy policy</p>
          <h2 id="priv-h" style="margin: 0; max-width: 14ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">What we <em style="font-style: italic;">keep.</em></h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: 24px; max-width: 62ch;">
          <p style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(20px, 2vw, 30px); line-height: 1.35;">The short version: your email, your order, nothing else.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">We collect the email address and order details needed to deliver your files and answer support questions, plus basic anonymous analytics about which pages are visited. Payment is handled by our payment processor — full card numbers never reach us.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">We don't sell or rent your data. Newsletter emails only go to people who asked for them, and every one carries a one-click unsubscribe.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">You can ask us for a copy of what we hold, or ask us to delete it, at any time. Write to the contact address and we'll action it.</p>
        </div>
      </div>
    </section>

    <section id="refunds" aria-labelledby="ref-h" style="padding: clamp(56px, 9vh, 110px) clamp(18px, 3.4vw, 54px); background: #EDEAE0;">
      <div data-two="" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div data-sticky="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">05 — Refund policy</p>
          <h2 id="ref-h" style="margin: 0; max-width: 14ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">If something's <em style="font-style: italic;">wrong.</em></h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: 24px; max-width: 62ch;">
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">Because every purchase is delivered instantly and can't be returned, sales are final and we don't offer refunds for change of mind. Please read what's included before buying — it's all listed on each palette page.</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.85; color: #5F5A54;">That said, we won't leave you stuck. If a file won't open, a download link fails, you were charged twice, or you received the wrong palette, write to us within 30 days and we'll fix it — resend, replace or refund as appropriate. Reach us at <a href="/contact/" style="text-decoration: underline; text-underline-offset: 3px;">contact@dwellingdream.shop</a>, or through the <a href="/contact/" style="text-decoration: underline; text-underline-offset: 3px;">contact form</a>; we reply within one working day.</p>
        </div>
      </div>
    </section>

    <section id="licensing" aria-labelledby="lic-h" style="padding: clamp(56px, 9vh, 110px) clamp(18px, 3.4vw, 54px);">
      <div data-two="" style="display: grid; grid-template-columns: 0.8fr 1.2fr; gap: clamp(26px, 5vw, 80px); align-items: start;">
        <div data-sticky="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">06 — Licensing &amp; usage</p>
          <h2 id="lic-h" style="margin: 0; max-width: 14ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 62px); line-height: 1;">What you <em style="font-style: italic;">may do.</em></h2>
        </div>
        <div data-lic-grid="" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #D8D2C8; max-width: 900px;">
          <div style="padding: clamp(22px, 2.4vw, 34px); background: #F5F2EA;">
            <p style="margin: 0 0 16px; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #6E675E;">Yes, please</p>
            <ul style="display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none;">
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Use the palette in your own home, as often as you like</li>
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Print pages for your own reference or to take to the paint counter</li>
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Use it with a client project you're personally working on</li>
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Share a photo of your finished room and tag us</li>
            </ul>
          </div>
          <div style="padding: clamp(22px, 2.4vw, 34px); background: #F5F2EA;">
            <p style="margin: 0 0 16px; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #6E675E;">Please don't</p>
            <ul style="display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none;">
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Forward, upload or resell the files</li>
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Reproduce the guides in your own product or course</li>
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Redistribute the pages as a free download</li>
              <li style="font-size: 13.5px; line-height: 1.7; color: #4E4A44;">Claim the palettes as your own work</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section aria-labelledby="cta-h" style="padding: clamp(64px, 10vh, 130px) clamp(18px, 3.4vw, 54px); background: #292825; color: #F5F2EA; text-align: center;">
      <h2 id="cta-h" style="margin: 0 auto 18px; max-width: 22ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4.6vw, 76px); line-height: .98;">Still stuck? <em style="font-style: italic; font-weight: 400;">Ask us.</em></h2>
      <p style="margin: 0 auto 30px; max-width: 48ch; font-size: clamp(14px, 1vw, 16px); line-height: 1.7; color: rgba(245,242,234,.84);">Real replies, usually within a day. No ticket numbers.</p>
      <a data-magnetic="" href="mailto:hello@dwellingdream.com" style="display: inline-flex; align-items: center; padding: 19px 34px; border-radius: 999px; background: #F5F2EA; color: #292825; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #DFD3C3; color: #292825;">Email support</a>
    </section>

    
  </main>
<script type="module">
import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';

  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);
</script>
<?php get_footer(); ?>