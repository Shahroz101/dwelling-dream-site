<?php
/**
 * Dwelling Dream theme.
 *
 * The storefront pages are ported from the design files (see
 * scripts/build-wp-theme.js); this file wires them to WordPress and
 * WooCommerce: page head data, the REST endpoints the page scripts call, the
 * product/cart helpers the templates use, and first-run page setup.
 */

if (!defined('ABSPATH')) exit;

define('DD_URI', get_template_directory_uri());
define('DD_ASSETS', DD_URI . '/assets');
define('DD_CONTACT_TO', 'contact@dwellingdream.shop');

require_once __DIR__ . '/inc/rest.php';
require_once __DIR__ . '/inc/product.php';
require_once __DIR__ . '/inc/setup-pages.php';

add_action('after_setup_theme', function () {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('html5', array('search-form', 'gallery', 'caption', 'script', 'style'));
  add_theme_support('woocommerce');
  // The pages carry their own gallery/zoom behaviour.
  remove_theme_support('wc-product-gallery-zoom');
  remove_theme_support('wc-product-gallery-lightbox');
  remove_theme_support('wc-product-gallery-slider');
});

/* -------------------------------------------------------------------------
 * Page head: each template hands over its <helmet> data before get_header().
 * ---------------------------------------------------------------------- */

function dd_page_head(array $meta) {
  $GLOBALS['dd_page_meta'] = $meta;
  if (!empty($meta['title'])) {
    // Both hooks, late: WooCommerce and hosting plugins rewrite the title of
    // the shop and terms pages on the parts filter, after the short-circuit.
    add_filter('pre_get_document_title', function () use ($meta) { return $meta['title']; }, 999);
    add_filter('document_title_parts', function () use ($meta) { return array('title' => $meta['title']); }, 999);
    add_filter('document_title_separator', function () { return '—'; }, 999);
  }
}

function dd_page_meta($key, $default = '') {
  $meta = isset($GLOBALS['dd_page_meta']) ? $GLOBALS['dd_page_meta'] : array();
  return isset($meta[$key]) ? $meta[$key] : $default;
}

add_action('wp_head', function () {
  $description = dd_page_meta('description');
  if ($description) {
    echo '<meta name="description" content="' . esc_attr($description) . '">' . "\n";
  }
}, 1);

/* -------------------------------------------------------------------------
 * Scripts and styles.
 * ---------------------------------------------------------------------- */

add_action('wp_enqueue_scripts', function () {
  wp_enqueue_style('dwelling-dream', get_stylesheet_uri(), array(), wp_get_theme()->get('Version'));
  wp_enqueue_style('dwelling-dream-fonts',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Manrope:wght@300;400;500;600&display=swap',
    array(), null);
  // [style-hover] hover styles from the design pages.
  wp_enqueue_script('dwelling-dream-hover', DD_URI . '/js/hover.js', array(), wp_get_theme()->get('Version'), true);

  // WooCommerce's own pages (checkout, account, order pages) are restyled to
  // the site's tokens. Everything else is inline-styled and needs no CSS.
  if (function_exists('is_checkout') && (is_checkout() || is_account_page())) {
    wp_enqueue_style('dwelling-dream-woo', DD_URI . '/css/woo.css', array(), wp_get_theme()->get('Version'));
  } else {
    // Keep WooCommerce's stylesheets off the custom-designed pages.
    foreach (array('woocommerce-general', 'woocommerce-layout', 'woocommerce-smallscreen', 'wc-blocks-style', 'woocommerce-inline') as $handle) {
      wp_dequeue_style($handle);
    }
  }
}, 20);

// Fonts: preconnect before the stylesheet request.
add_filter('wp_resource_hints', function ($urls, $relation) {
  if ($relation === 'preconnect') {
    $urls[] = 'https://fonts.googleapis.com';
    $urls[] = array('href' => 'https://fonts.gstatic.com', 'crossorigin' => '');
  }
  return $urls;
}, 10, 2);

// Hosting-plugin and core noise the design pages never carried.
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('wp_head', 'wp_generator');
remove_action('wp_head', 'wlwmanifest_link');
remove_action('wp_head', 'rsd_link');
add_filter('woocommerce_enqueue_styles', '__return_empty_array');

/* -------------------------------------------------------------------------
 * Cart count for the header badge (server-rendered; cart.js keeps it live).
 * ---------------------------------------------------------------------- */

// WooCommerce returns the symbol HTML-encoded ("&#36;"); the templates and
// scripts want the character.
function dd_currency_symbol() {
  return html_entity_decode(get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8');
}

function dd_cart_count() {
  if (function_exists('WC') && WC()->cart) {
    return (int) WC()->cart->get_cart_contents_count();
  }
  return 0;
}

/* -------------------------------------------------------------------------
 * Contact form mail (the /api/contact route in server.js, on wp_mail).
 * ---------------------------------------------------------------------- */

function dd_send_contact_mail($name, $email, $message) {
  $subject = sprintf('[Dwelling Dream] Message from %s', $name);
  $body = "Name: {$name}\nEmail: {$email}\n\n{$message}\n";
  $headers = array('Reply-To: ' . $name . ' <' . $email . '>');
  return wp_mail(DD_CONTACT_TO, $subject, $body, $headers);
}

/* -------------------------------------------------------------------------
 * WooCommerce tweaks.
 * ---------------------------------------------------------------------- */

// The order confirmation ("thank you") page shows downloads inline; do not
// also render WooCommerce's default order details table under it.
add_action('init', function () {
  remove_action('woocommerce_thankyou', 'woocommerce_order_details_table', 10);
});

// Every product is a digital download: hide the shipping/stock noise that
// WooCommerce would otherwise add to the product page.
add_filter('woocommerce_product_needs_shipping', '__return_false');

// The templates use the "large" image size (and WooCommerce its thumbnail
// in the cart and admin). Skipping the other sizes turns ten resizes per
// uploaded product photo into two - on shared hosting the difference is
// whether a catalogue import finishes.
add_filter('intermediate_image_sizes_advanced', function ($sizes) {
  return array_intersect_key($sizes, array_flip(array('large', 'woocommerce_thumbnail')));
});
add_filter('big_image_size_threshold', function () { return 2000; });

/* -------------------------------------------------------------------------
 * Pinterest feed: the fields the old Node feed carried that Pinterest for
 * WooCommerce leaves out and then warns about (condition, Google product
 * category), plus the brand. Same values as lib/product-feed.js.
 * ---------------------------------------------------------------------- */

define('DD_GOOGLE_PRODUCT_CATEGORY', 'Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork');

add_filter('pinterest_for_woocommerce_feed_item_xml', function ($xml, $product) {
  // The plugin puts the product category (the paint manufacturer a palette
  // matches) in product_type; Pinterest's merchant review reads a
  // manufacturer's name there as a claim about who made the product.
  $xml = preg_replace('#<g:product_type>.*?</g:product_type>#s', '<g:product_type>Paint Color Palettes</g:product_type>', $xml);
  $extra = '';
  if (strpos($xml, '<g:condition>') === false) {
    $extra .= "\t\t\t<g:condition>new</g:condition>\n";
  }
  if (strpos($xml, '<g:google_product_category>') === false) {
    $extra .= "\t\t\t<g:google_product_category>" . htmlspecialchars(DD_GOOGLE_PRODUCT_CATEGORY, ENT_XML1) . "</g:google_product_category>\n";
  }
  if (strpos($xml, '<g:brand>') === false) {
    $extra .= "\t\t\t<g:brand>Dwelling Dream</g:brand>\n";
  }
  return $extra ? str_replace('</item>', $extra . "\t\t</item>", $xml) : $xml;
}, 10, 2);
