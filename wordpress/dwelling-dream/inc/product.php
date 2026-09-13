<?php
/**
 * Product page helpers. The template (woocommerce/single-product.php) is the
 * design page's markup; these fill in what the old client script used to
 * fetch, so the page is complete before any JavaScript runs.
 */

if (!defined('ABSPATH')) exit;

function dd_product_view($product) {
  if (!$product instanceof WC_Product) {
    $product = wc_get_product(get_the_ID());
  }
  $view = dd_public_product($product);
  $view['price_text'] = dd_currency_symbol() . number_format($view['price'], 2);
  $view['product'] = $product;
  return $view;
}

/**
 * Main image with crossfading views, plus the thumbnail strip. Same markup
 * the design page's updateGallery() produced.
 */
function dd_product_gallery(array $dd) {
  $images = $dd['images'];
  if (!$images) $images = array(DD_ASSETS . '/dd2-bundle-palette.webp');
  $title = $dd['title'];
  ?>
  <div data-main-media="" style="position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #E3DED3;">
    <?php foreach ($images as $i => $url): ?>
    <div data-view="<?php echo $i; ?>" style="position:absolute; inset:0; opacity:<?php echo $i === 0 ? 1 : 0; ?>; transition:opacity .5s ease; <?php echo $i === 0 ? '' : 'pointer-events:none;'; ?>">
      <img src="<?php echo esc_url($url); ?>" alt="<?php echo esc_attr($title); ?> image <?php echo $i + 1; ?>" style="width:100%; height:100%; display:block; object-fit:cover;" draggable="false"<?php echo $i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'; ?> />
    </div>
    <?php endforeach; ?>
    <?php if (count($images) > 1): ?>
    <button data-slide-prev="" aria-label="Previous image" style="position:absolute; top:50%; left:14px; transform:translateY(-50%); width:38px; height:38px; border:0; border-radius:50%; background:rgba(245,242,234,.9); color:#292825; font-size:17px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 16px rgba(41,40,37,.15);">‹</button>
    <button data-slide-next="" aria-label="Next image" style="position:absolute; top:50%; right:14px; transform:translateY(-50%); width:38px; height:38px; border:0; border-radius:50%; background:rgba(245,242,234,.9); color:#292825; font-size:17px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 16px rgba(41,40,37,.15);">›</button>
    <?php endif; ?>
  </div>
  <div role="tablist" aria-label="Product images" style="display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px;">
    <?php foreach ($images as $i => $url): ?>
    <button data-thumb="<?php echo $i; ?>" role="tab" aria-selected="<?php echo $i === 0 ? 'true' : 'false'; ?>" aria-label="Image <?php echo $i + 1; ?>" style="flex:0 0 auto; scroll-snap-align:start; width:56px; height:56px; padding:0; border:1px solid <?php echo $i === 0 ? '#292825' : '#D8D2C8'; ?>; background:<?php echo $i % 2 ? '#CDD2CA' : '#DCDDD8'; ?>; cursor:pointer; opacity:<?php echo $i === 0 ? 1 : .72; ?>; transition:border-color .35s ease, opacity .35s ease; background-image:url('<?php echo esc_url($url); ?>'); background-size:cover; background-position:center;"></button>
    <?php endforeach; ?>
  </div>
  <?php
}

/**
 * "Pairs beautifully with these": three other palettes, newest first.
 */
function dd_product_recommended(array $dd) {
  $shown = 0;
  foreach (dd_all_products() as $other) {
    if ($other->get_id() === $dd['id']) continue;
    $view = dd_public_product($other);
    $image = $view['images'] ? $view['images'][0] : DD_ASSETS . '/dd2-bundle-palette.webp';
    ?>
    <a href="<?php echo esc_url(get_permalink($other->get_id())); ?>" style="display: block;">
      <article data-rcard="" style="display: flex; flex-direction: column; background: #F5F2EA; transition: transform .6s cubic-bezier(.22,1,.36,1), box-shadow .6s ease;">
        <div data-rmedia="" style="position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: #E3DED3;">
          <img src="<?php echo esc_url($image); ?>" alt="<?php echo esc_attr($view['title']); ?>" loading="lazy" style="width: 100%; height: 100%; display: block; object-fit: cover;" />
        </div>
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 18px 20px 22px;">
          <div>
            <p style="margin: 0 0 6px; font-size: 10px; letter-spacing: .24em; text-transform: uppercase; color: #A9A29A;"><?php echo esc_html($view['category'] ?: 'Palette'); ?></p>
            <h3 style="margin: 0 0 6px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(20px, 1.8vw, 28px); line-height: 1;"><?php echo esc_html($view['title']); ?></h3>
            <p style="margin: 0; max-width: 30ch; font-size: 12.5px; line-height: 1.65; color: #6E675E;"><?php echo esc_html($view['description']); ?></p>
          </div>
          <p style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px;"><?php echo esc_html(dd_currency_symbol() . number_format($view['price'], 2)); ?></p>
        </div>
      </article>
    </a>
    <?php
    if (++$shown >= 3) break;
  }
  if (!$shown) {
    echo '<p style="margin:0; font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:#78736E;">No other products in the catalog yet.</p>';
  }
}

/**
 * The product handed to the page script (window.DD_PRODUCT) so add-to-cart
 * and buy-now know what to add.
 */
function dd_product_json(array $dd) {
  $copy = $dd;
  unset($copy['product']);
  return wp_json_encode($copy);
}

/**
 * schema.org Product markup, as the Node site emitted it (lib/product-feed.js
 * productJsonLd). Pinterest and Google read price/availability from it to
 * confirm the landing page agrees with the feed.
 */
function dd_product_json_ld(array $dd) {
  $schema = array(
    '@context' => 'https://schema.org',
    '@type' => 'Product',
    'name' => $dd['title'],
    'description' => $dd['description'],
    'image' => array_slice($dd['images'], 0, 10),
    'url' => get_permalink($dd['id']),
    'brand' => array('@type' => 'Brand', 'name' => 'Dwelling Dream'),
    'offers' => array(
      '@type' => 'Offer',
      'price' => number_format($dd['price'], 2, '.', ''),
      'priceCurrency' => $dd['currency'],
      'availability' => 'https://schema.org/InStock',
      'url' => get_permalink($dd['id']),
      'itemCondition' => 'https://schema.org/NewCondition'
    )
  );
  if ($dd['sku']) $schema['sku'] = $dd['sku'];
  $schema['category'] = 'Paint Color Palettes';
  return '<script type="application/ld+json">' . str_replace('<', '\\u003c', wp_json_encode($schema, JSON_UNESCAPED_SLASHES)) . '</script>';
}

add_action('wp_head', function () {
  if (function_exists('is_product') && is_product()) {
    echo dd_product_json_ld(dd_product_view(wc_get_product(get_queried_object_id()))) . "\n";
  }
}, 5);
