<?php
/**
 * Generic page shell - used by WooCommerce's own pages (checkout, account,
 * order pages) and any page without a design template of its own. The
 * storefront pages have dedicated page-<slug>.php templates.
 */
if (!defined('ABSPATH')) exit;
dd_page_head(array('title' => get_the_title() . ' — Dwelling Dream', 'description' => get_bloginfo('description'), 'style' => ''));
get_header();
?>
<main id="top">
  <?php if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('order-received')): ?>
    <?php // The confirmation template (woocommerce/checkout/thankyou.php) is a full section of its own. ?>
    <?php while (have_posts()): the_post(); the_content(); endwhile; ?>
  <?php else: ?>
  <section style="padding: clamp(104px, 14vh, 160px) clamp(18px, 3.4vw, 54px) clamp(64px, 10vh, 120px); min-height: 60vh;">
    <div class="dd-page" style="max-width: 1180px; margin: 0 auto;">
      <?php if (!(function_exists('is_checkout') && is_checkout())): ?>
      <h1 style="margin: 0 0 clamp(24px, 4vh, 40px); font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(34px, 4.6vw, 68px); line-height: 1.02;"><?php the_title(); ?></h1>
      <?php endif; ?>
      <?php while (have_posts()): the_post(); the_content(); endwhile; ?>
    </div>
  </section>
  <?php endif; ?>
</main>
<script type="module">
  import { initDwellingDream } from '<?php echo DD_URI; ?>/js/interactions.js';
  import { syncCartBadge } from '<?php echo DD_URI; ?>/js/cart.js';
  initDwellingDream(document, { navThreshold: -1 });
  syncCartBadge(document);
</script>
<?php get_footer(); ?>
