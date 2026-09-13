<?php
if (!defined('ABSPATH')) exit;
dd_page_head(array('title' => 'Not found — Dwelling Dream', 'description' => '', 'style' => ''));
get_header();
?>
<main id="top">
  <section style="padding: clamp(140px, 20vh, 220px) clamp(18px, 3.4vw, 54px) clamp(120px, 18vh, 200px); text-align: center;">
    <p style="margin: 0 0 14px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Not found</p>
    <h1 style="margin: 0 0 18px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 54px); line-height: 1.05;">We couldn't find that page.</h1>
    <p style="margin: 0 auto 30px; max-width: 46ch; font-size: 14px; line-height: 1.7; color: #78736E;">It may have been renamed or is no longer available. Browse the full collection instead.</p>
    <a href="/palettes/" style="display: inline-flex; align-items: center; padding: 17px 30px; border-radius: 999px; background: #292825; color: #F5F2EA; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase;">All palettes →</a>
  </section>
</main>
<script type="module">
  import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';
  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);
</script>
<?php get_footer(); ?>
