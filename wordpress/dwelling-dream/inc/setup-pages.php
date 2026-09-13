<?php
/**
 * First-run setup: the pages the templates are written for, at the URLs the
 * storefront has always used. Runs on theme activation and is idempotent -
 * existing pages are found by slug and left alone.
 */

if (!defined('ABSPATH')) exit;

add_action('after_switch_theme', 'dd_setup_pages');

function dd_find_page($slug, $parent = 0) {
  $pages = get_posts(array(
    'post_type' => 'page',
    'name' => $slug,
    'post_parent' => $parent,
    'post_status' => array('publish', 'draft'),
    'numberposts' => 1
  ));
  return $pages ? $pages[0] : null;
}

function dd_ensure_page($title, $slug, $parent = 0) {
  $existing = dd_find_page($slug, $parent);
  if ($existing) {
    if ($existing->post_status !== 'publish') {
      wp_update_post(array('ID' => $existing->ID, 'post_status' => 'publish'));
    }
    return $existing->ID;
  }
  return wp_insert_post(array(
    'post_type' => 'page',
    'post_title' => $title,
    'post_name' => $slug,
    'post_parent' => $parent,
    'post_status' => 'publish',
    // The template renders everything; the editor content is only a note.
    'post_content' => '<!-- wp:paragraph --><p>This page is rendered by the Dwelling Dream theme.</p><!-- /wp:paragraph -->'
  ));
}

function dd_setup_pages() {
  $home = dd_ensure_page('Home', 'home');
  update_option('show_on_front', 'page');
  update_option('page_on_front', $home);

  dd_ensure_page('About', 'about');
  dd_ensure_page('Contact', 'contact');
  $help = dd_ensure_page('Help', 'help');
  dd_ensure_page('Shipping Policy', 'shipping-policy', $help);
  $returns = dd_ensure_page('Return Policy', 'return-policy', $help);
  $privacy = dd_ensure_page('Privacy Policy', 'privacy-policy', $help);
  $terms = dd_ensure_page('Terms of Service', 'terms-of-service', $help);

  // The catalogue lives at /palettes/, the same base as the product URLs.
  $palettes = dd_ensure_page('Palettes', 'palettes');
  update_option('woocommerce_shop_page_id', $palettes);

  // WooCommerce and Pinterest both link to these.
  update_option('wp_page_for_privacy_policy', $privacy);
  update_option('woocommerce_terms_page_id', $terms);

  // WooCommerce's default "Shop" page would otherwise sit at /shop/ as a
  // duplicate catalogue.
  $shop = dd_find_page('shop');
  if ($shop && $shop->ID !== $palettes) {
    wp_update_post(array('ID' => $shop->ID, 'post_status' => 'draft'));
  }

  flush_rewrite_rules();
}

function dd_setup_report() {
  $report = array();
  foreach (get_pages(array('post_status' => 'publish')) as $page) {
    $report[] = get_permalink($page->ID);
  }
  $report[] = 'front: ' . get_option('page_on_front') . ' shop: ' . get_option('woocommerce_shop_page_id');
  return $report;
}
