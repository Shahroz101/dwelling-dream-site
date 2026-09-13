<?php
/**
 * REST endpoints the page scripts call. They keep the response shapes of the
 * Node routes they replace (/api/products, /api/reviews, /api/contact) so the
 * design pages' scripts work with only their URLs changed.
 */

if (!defined('ABSPATH')) exit;

add_action('rest_api_init', function () {
  register_rest_route('dd/v1', '/products', array(
    'methods' => 'GET',
    'callback' => 'dd_rest_products',
    'permission_callback' => '__return_true'
  ));
  register_rest_route('dd/v1', '/reviews', array(
    'methods' => 'GET',
    'callback' => 'dd_rest_reviews',
    'permission_callback' => '__return_true'
  ));
  // Runs the first-run page setup on demand (administrators only) - hosting
  // panels that activate the theme by writing the option directly skip the
  // after_switch_theme hook it normally runs on.
  register_rest_route('dd/v1', '/setup', array(
    'methods' => 'POST',
    'callback' => function () { dd_setup_pages(); return array('success' => true, 'pages' => dd_setup_report()); },
    'permission_callback' => function () { return current_user_can('manage_options'); }
  ));
  // Re-reads the connected Pinterest account (username, verified websites)
  // from Pinterest. The plugin only does this on OAuth, so after the
  // advertiser is switched from the API the stored account data goes stale.
  register_rest_route('dd/v1', '/pinterest-refresh', array(
    'methods' => 'POST',
    'callback' => function () {
      if (!class_exists('Pinterest_For_Woocommerce')) return new WP_Error('dd_no_plugin', 'Pinterest for WooCommerce is not active', array('status' => 500));
      $data = Pinterest_For_Woocommerce::update_account_data();
      return array('success' => true, 'account_data' => $data);
    },
    'permission_callback' => function () { return current_user_can('manage_options'); }
  ));
  // Asks Pinterest to fetch the registered feed again now, instead of on
  // its daily schedule (a no-op update of the feed triggers a re-fetch).
  register_rest_route('dd/v1', '/pinterest-refetch', array(
    'methods' => 'POST',
    'callback' => function () {
      if (!class_exists('Automattic\\WooCommerce\\Pinterest\\Feeds')) return new WP_Error('dd_no_plugin', 'Pinterest for WooCommerce is not active', array('status' => 500));
      $feed_id = Automattic\WooCommerce\Pinterest\FeedRegistration::get_locally_stored_registered_feed_id();
      if (!$feed_id) return new WP_Error('dd_no_feed', 'No feed is registered yet', array('status' => 409));
      $result = Automattic\WooCommerce\Pinterest\Feeds::reschedule_feed_fetch($feed_id);
      return array('success' => true, 'feed_id' => $feed_id, 'feed' => $result);
    },
    'permission_callback' => function () { return current_user_can('manage_options'); }
  ));
  register_rest_route('dd/v1', '/contact', array(
    'methods' => 'POST',
    'callback' => 'dd_rest_contact',
    'permission_callback' => '__return_true'
  ));
});

/**
 * The catalogue as the pages expect it: id, sku, title, description, category
 * (the paint brand), price, images, slug. Cached per request only; WooCommerce
 * caches the underlying product reads itself.
 */
function dd_public_product(WC_Product $product) {
  $images = array();
  $ids = array_merge(array($product->get_image_id()), $product->get_gallery_image_ids());
  foreach ($ids as $id) {
    if (!$id) continue;
    $url = wp_get_attachment_image_url($id, 'large');
    if ($url) $images[] = $url;
  }
  $terms = get_the_terms($product->get_id(), 'product_cat');
  $category = '';
  if (is_array($terms)) {
    foreach ($terms as $term) {
      if ($term->slug === 'uncategorized') continue;
      $category = $term->name;
      break;
    }
  }
  $description = $product->get_short_description();
  if (!$description) $description = $product->get_description();
  return array(
    'id' => $product->get_id(),
    'sku' => $product->get_sku(),
    'title' => $product->get_name(),
    'description' => trim(wp_strip_all_tags($description)),
    'category' => $category,
    'price' => (float) wc_get_price_to_display($product),
    'currency' => get_woocommerce_currency(),
    'images' => $images,
    'slug' => $product->get_slug(),
    'active' => $product->get_status() === 'publish',
    'updatedAt' => $product->get_date_modified() ? $product->get_date_modified()->date('c') : null
  );
}

function dd_all_products() {
  return wc_get_products(array(
    'status' => 'publish',
    'limit' => -1,
    'orderby' => 'date',
    'order' => 'DESC',
    'visibility' => 'catalog'
  ));
}

function dd_rest_products() {
  $products = array_map('dd_public_product', dd_all_products());
  $response = new WP_REST_Response(array('products' => $products));
  $response->header('Cache-Control', 'public, max-age=300');
  return $response;
}

/**
 * Shop-wide reviews brought over from Etsy (data/reviews.json). None of them
 * names a palette, so they are not product reviews and the product page
 * labels them accordingly.
 */
function dd_rest_reviews() {
  $file = get_template_directory() . '/data/reviews.json';
  $reviews = array();
  if (file_exists($file)) {
    $decoded = json_decode(file_get_contents($file), true);
    if (is_array($decoded)) $reviews = $decoded;
  }
  $count = count($reviews);
  $average = null;
  if ($count) {
    $sum = 0;
    foreach ($reviews as $review) $sum += (float) ($review['rating'] ?? 0);
    $average = round($sum / $count, 2);
  }
  return array('success' => true, 'reviews' => $reviews, 'count' => $count, 'average' => $average);
}

function dd_rest_contact(WP_REST_Request $request) {
  $params = $request->get_json_params();
  if (!is_array($params)) $params = array();

  // Honeypot: the visible form never fills "website".
  if (!empty($params['website'])) {
    return array('success' => true, 'message' => 'Thanks - your message is on its way.');
  }

  $name = sanitize_text_field($params['name'] ?? '');
  $rawEmail = trim((string) ($params['email'] ?? ''));
  $email = sanitize_email($rawEmail);
  $message = sanitize_textarea_field($params['message'] ?? '');

  if (!$name || !$rawEmail || !$message) {
    return new WP_REST_Response(array('success' => false, 'message' => 'Please fill in your name, email and message.'), 400);
  }
  if (!$email || !is_email($email)) {
    return new WP_REST_Response(array('success' => false, 'message' => 'That email address does not look right.'), 400);
  }
  if (strlen($message) > 16 * 1024) {
    return new WP_REST_Response(array('success' => false, 'message' => 'That message is too long.'), 400);
  }

  // Five messages per address per fifteen minutes, as on the Node server.
  $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
  $key = 'dd_contact_' . md5($ip);
  $recent = (int) get_transient($key);
  if ($recent >= 5) {
    return new WP_REST_Response(array('success' => false, 'message' => 'Too many messages from this address. Please try again later.'), 429);
  }
  set_transient($key, $recent + 1, 15 * MINUTE_IN_SECONDS);

  if (!dd_send_contact_mail($name, $email, $message)) {
    return new WP_REST_Response(array('success' => false, 'message' => 'We could not send that just now. Please email ' . DD_CONTACT_TO . ' directly.'), 502);
  }
  return array('success' => true, 'message' => 'Thanks - your message is on its way.');
}
