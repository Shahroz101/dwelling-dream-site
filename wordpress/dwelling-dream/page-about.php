<?php
// Generated from "Dwelling Dream About.dc.html" by scripts/build-wp-theme.js - edit the
// design page and rebuild rather than editing this file.
if (!defined('ABSPATH')) exit;
dd_page_head(array(
  'title' => 'About — Dwelling Dream',
  'description' => 'About Dwelling Dream — how Shahroz builds nine-color paint palettes designed to make choosing color feel simple.',
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

    <section aria-labelledby="about-h" style="position: relative; padding: clamp(120px, 17vh, 200px) clamp(18px, 3.4vw, 54px) clamp(64px, 10vh, 120px); overflow: hidden;">
      <div data-depth="1.2" style="position: absolute; right: -3%; top: 5%; width: clamp(130px, 14vw, 220px); z-index: 0; animation: dd-float 13s ease-in-out infinite; pointer-events: none;" aria-hidden="true">
        <span style="position: absolute; left: 30%; top: 26%; width: 20%; aspect-ratio: 1; border-radius: 50%; background: #DFD3C3;"></span>
        <span style="position: absolute; left: 58%; top: 12%; width: 8%; aspect-ratio: 1; border-radius: 50%; background: #ACAD97;"></span>
        <span style="position: absolute; left: 16%; top: 52%; width: 12%; aspect-ratio: 1; border-radius: 50%; background: #C2DAE0;"></span>
        <span style="position: absolute; left: 70%; top: 44%; width: 5.5%; aspect-ratio: 1; border-radius: 50%; background: #AC6B53;"></span>
        <span style="position: absolute; left: 46%; top: 64%; width: 7%; aspect-ratio: 1; border-radius: 50%; background: #9BBFC9;"></span>
        <span style="position: absolute; left: 24%; top: 10%; width: 4%; aspect-ratio: 1; border-radius: 50%; background: #817A6E;"></span>
        <span style="position: absolute; left: 78%; top: 68%; width: 3.6%; aspect-ratio: 1; border-radius: 50%; background: #DFD3C3;"></span>
        <span style="position: absolute; left: 56%; top: 82%; width: 2.8%; aspect-ratio: 1; border-radius: 50%; background: #ACAD97;"></span>
        <span style="position: absolute; left: 8%; top: 34%; width: 2.4%; aspect-ratio: 1; border-radius: 50%; background: #AC6B53;"></span>
        <span style="position: absolute; left: 40%; top: 44%; width: 2%; aspect-ratio: 1; border-radius: 50%; background: #78736E;"></span>
      </div>
      <div data-depth="2" style="position: absolute; left: -1.5%; bottom: -3%; width: clamp(80px, 9vw, 132px); z-index: 0; animation: dd-float 9.5s ease-in-out infinite; pointer-events: none;" aria-hidden="true">
        <span style="position: absolute; left: 34%; top: 30%; width: 19%; aspect-ratio: 1; border-radius: 50%; background: #C2DAE0;"></span>
        <span style="position: absolute; left: 14%; top: 58%; width: 9%; aspect-ratio: 1; border-radius: 50%; background: #DFD3C3;"></span>
        <span style="position: absolute; left: 64%; top: 20%; width: 6.5%; aspect-ratio: 1; border-radius: 50%; background: #9BBFC9;"></span>
        <span style="position: absolute; left: 60%; top: 66%; width: 4.6%; aspect-ratio: 1; border-radius: 50%; background: #ACAD97;"></span>
        <span style="position: absolute; left: 26%; top: 16%; width: 3.2%; aspect-ratio: 1; border-radius: 50%; background: #817A6E;"></span>
        <span style="position: absolute; left: 82%; top: 46%; width: 2.8%; aspect-ratio: 1; border-radius: 50%; background: #AC6B53;"></span>
      </div>


      <div data-hero-grid="" style="position: relative; z-index: 1; display: grid; grid-template-columns: 1.5fr 0.85fr; gap: clamp(28px, 5vw, 76px); align-items: end;">
      <div style="display: flex; flex-direction: column; gap: clamp(18px, 2.6vh, 26px);">
      <p data-reveal="" style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">About · Dwelling Dream</p>
      <h1 id="about-h" data-reveal="" style="margin: 0; max-width: 24ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(42px, 7vw, 124px); line-height: .95; letter-spacing: -.015em; text-wrap: balance;">I started with forty paint chips and <em style="font-style: italic; font-weight: 400;">no idea.</em></h1>
      <p data-reveal="" style="margin: 0; max-width: 58ch; font-size: clamp(15px, 1.2vw, 19px); line-height: 1.7; color: #5F5A54;">Hi, I'm Shahroz. Dwelling Dream is the shortcut I wish I'd had — nine colors that already agree with each other, so you can stop guessing and start painting.</p>
      </div>
      <div style="display: flex; flex-direction: column;">
      <div data-portrait="" data-reveal="" style="position: relative; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; background: #E3DED3;">
        <img src="<?php echo DD_ASSETS; ?>/dd2-owner.webp" alt="Founder portrait — Shahroz" style="width: 100%; height: 100%; display: block; object-fit: cover;" />
      </div>
      <p data-reveal="" style="margin: 12px 0 0; font-size: 10px; letter-spacing: .26em; text-transform: uppercase; color: #A9A29A;">Shahroz · Founder, Dwelling Dream</p>
      </div>
      </div>
    </section>

    <section aria-labelledby="story-h" style="position: relative; padding: clamp(60px, 9vh, 110px) clamp(18px, 3.4vw, 54px) clamp(70px, 11vh, 130px); background: #EDEAE0;">
      <div data-story-grid="" style="display: grid; grid-template-columns: 0.75fr 1.25fr; gap: clamp(26px, 5vw, 90px); align-items: start;">
        <div data-reveal="" style="position: sticky; top: clamp(110px, 14vh, 150px);">
          <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">The story</p>
          <h2 id="story-h" style="margin: 0; max-width: 16ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 3.8vw, 62px); line-height: 1;">How this <em style="font-style: italic;">began.</em></h2>
        </div>
        <div style="display: flex; flex-direction: column; gap: clamp(20px, 3vh, 30px); max-width: 62ch;">
          <p data-reveal="" style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(21px, 2.1vw, 32px); line-height: 1.35; color: #292825;">The first room I painted took me three weekends. Not because of the painting — because of the deciding.</p>
          <p data-reveal="" style="margin: 0; font-size: clamp(14px, 1.05vw, 16.5px); line-height: 1.8; color: #5F5A54;">I taped chips to the wall, looked at them in the morning, hated them by evening, and bought four more. Every color looked right on its own and wrong next to the last one. What I was missing wasn't taste — it was a plan. No one tells you that a color is only ever as good as the eight colors around it.</p>
          <p data-reveal="" style="margin: 0; font-size: clamp(14px, 1.05vw, 16.5px); line-height: 1.8; color: #5F5A54;">So I started building palettes instead of picking colors. Nine shades at a time: the whites and warm neutrals that carry most of a home, the mid-tones that give rooms their mood, and the deep anchors that make everything else look intentional. I tested them in north-facing rooms and south-facing ones, under daylight and under a single lamp at night.</p>
          <p data-reveal="" style="margin: 0; font-size: clamp(14px, 1.05vw, 16.5px); line-height: 1.8; color: #5F5A54;">Friends started asking for the lists. Then their friends did. Dwelling Dream is what those lists became — palettes, guides and planners for anyone standing in front of a wall with too many options and not enough time.</p>
          <p data-reveal="" style="margin: 6px 0 0; font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: clamp(20px, 1.9vw, 30px); color: #292825;">— Shahroz</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="phil-h" style="position: relative; padding: clamp(70px, 11vh, 140px) clamp(18px, 3.4vw, 54px); background: #F5F2EA;">
      <div data-reveal="" style="max-width: 700px; margin-bottom: clamp(38px, 6vh, 68px);">
        <p style="margin: 0 0 16px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Color philosophy</p>
        <h2 id="phil-h" style="margin: 0 0 18px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(32px, 4.6vw, 78px); line-height: .98;">Four things I believe about <em style="font-style: italic;">color.</em></h2>
        <p style="margin: 0; max-width: 54ch; font-size: clamp(14px, 1vw, 16px); line-height: 1.7; color: #78736E;">Everything on this site comes out of these four ideas.</p>
      </div>

      <div data-beliefs="" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: #D8D2C8;">

        <article data-belief="" style="position: relative; display: flex; flex-direction: column; gap: 14px; padding: clamp(26px, 3vw, 48px); background: #F5F2EA; transition: background .5s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <span style="font-size: 11px; letter-spacing: .24em; color: #A9A29A;">01</span>
            <span data-chip="" style="width: 34px; height: 34px; border-radius: 50%; background: #DFD3C3; transition: transform .6s cubic-bezier(.22,1,.36,1);"></span>
          </div>
          <h3 style="margin: 0; max-width: 20ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(24px, 2.4vw, 40px); line-height: 1.05;">Fewer options, better rooms.</h3>
          <p style="margin: 0; max-width: 44ch; font-size: 14px; line-height: 1.75; color: #5F5A54;">A thousand paint chips is not freedom, it's paralysis. Nine is enough to decorate a whole house — and few enough to actually decide.</p>
        </article>

        <article data-belief="" style="position: relative; display: flex; flex-direction: column; gap: 14px; padding: clamp(26px, 3vw, 48px); background: #F5F2EA; transition: background .5s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <span style="font-size: 11px; letter-spacing: .24em; color: #A9A29A;">02</span>
            <span data-chip="" style="width: 34px; height: 34px; border-radius: 50%; background: #9BBFC9; transition: transform .6s cubic-bezier(.22,1,.36,1);"></span>
          </div>
          <h3 style="margin: 0; max-width: 20ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(24px, 2.4vw, 40px); line-height: 1.05;">Light decides everything.</h3>
          <p style="margin: 0; max-width: 44ch; font-size: 14px; line-height: 1.75; color: #5F5A54;">The same white is cream in a south-facing room and grey in a north-facing one. That's why every palette lists LRV values and comes tested in both.</p>
        </article>

        <article data-belief="" style="position: relative; display: flex; flex-direction: column; gap: 14px; padding: clamp(26px, 3vw, 48px); background: #F5F2EA; transition: background .5s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <span style="font-size: 11px; letter-spacing: .24em; color: #A9A29A;">03</span>
            <span data-chip="" style="width: 34px; height: 34px; border-radius: 50%; background: #ACAD97; transition: transform .6s cubic-bezier(.22,1,.36,1);"></span>
          </div>
          <h3 style="margin: 0; max-width: 20ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(24px, 2.4vw, 40px); line-height: 1.05;">A home should read as one idea.</h3>
          <p style="margin: 0; max-width: 44ch; font-size: 14px; line-height: 1.75; color: #5F5A54;">Rooms chosen one at a time fight each other in the hallway. Palettes are built to flow, so moving between rooms feels like a change of key, not a change of subject.</p>
        </article>

        <article data-belief="" style="position: relative; display: flex; flex-direction: column; gap: 14px; padding: clamp(26px, 3vw, 48px); background: #F5F2EA; transition: background .5s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <span style="font-size: 11px; letter-spacing: .24em; color: #A9A29A;">04</span>
            <span data-chip="" style="width: 34px; height: 34px; border-radius: 50%; background: #AC6B53; transition: transform .6s cubic-bezier(.22,1,.36,1);"></span>
          </div>
          <h3 style="margin: 0; max-width: 20ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(24px, 2.4vw, 40px); line-height: 1.05;">Warm neutrals are not boring.</h3>
          <p style="margin: 0; max-width: 44ch; font-size: 14px; line-height: 1.75; color: #5F5A54;">Restraint is what makes one terracotta or one deep navy land. The quiet colors do the work; the bold one gets the credit.</p>
        </article>
      </div>
    </section>

    <section aria-labelledby="news-h" style="position: relative; padding: clamp(76px, 12vh, 150px) clamp(18px, 3.4vw, 54px) clamp(70px, 11vh, 130px); background: #292825; color: #F5F2EA; overflow: hidden;">
      <div style="position: absolute; inset: 0; pointer-events: none; opacity: .2; mix-blend-mode: overlay; background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E&quot;);"></div>
      <div data-depth="1.6" aria-hidden="true" style="position: absolute; left: 8%; top: 22%; width: clamp(50px, 5.5vw, 82px); height: clamp(50px, 5.5vw, 82px); border-radius: 50%; background: radial-gradient(circle at 32% 26%, #FFFFFF, #DFD3C3 54%, #A2947F); box-shadow: 18px 26px 40px rgba(0,0,0,.42); animation: dd-float 11s ease-in-out infinite; pointer-events: none;"></div>

      <div style="position: relative; max-width: 760px; margin: 0 auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 22px;">
        <p data-reveal="" style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: rgba(245,242,234,.7);">The letter</p>
        <h2 id="news-h" data-reveal="" style="margin: 0; max-width: 22ch; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(34px, 5.4vw, 90px); line-height: .97;">One palette, once a <em style="font-style: italic; font-weight: 400;">month.</em></h2>
        <p data-reveal="" style="margin: 0; max-width: 50ch; font-size: clamp(14px, 1vw, 16.5px); line-height: 1.75; color: rgba(245,242,234,.84);">A new nine-color palette, where it came from, and how to use it — plus the occasional honest note about a color that didn't work.</p>
        <form data-news="" data-reveal="" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; width: 100%; max-width: 520px; margin-top: 8px;">
          <label for="dda-email" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%);">Email address</label>
          <input id="dda-email" data-news-input="" type="email" required="" placeholder="you@email.com" style="flex: 1 1 240px; min-width: 0; padding: 17px 20px; border: 1px solid rgba(245,242,234,.34); border-radius: 999px; background: rgba(245,242,234,.06); color: #F5F2EA; font-family: inherit; font-size: 14px; transition: border-color .3s ease, background .3s ease;" />
          <button data-magnetic="" type="submit" style="flex: 0 0 auto; padding: 17px 30px; border: 0; border-radius: 999px; background: #F5F2EA; color: #292825; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; cursor: pointer; transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #DFD3C3; color: #292825;">Join</button>
        </form>
        <p data-news-msg="" role="status" aria-live="polite" style="margin: 0; min-height: 18px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: rgba(245,242,234,.7);"></p>
      </div>
    </section>

    
  </main>
<script type="module">
import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';

  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);
</script>
<?php get_footer(); ?>