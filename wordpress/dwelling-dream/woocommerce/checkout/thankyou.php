<?php
/**
 * Order confirmation, in the storefront's Order page design. WooCommerce
 * renders this on /checkout/order-received/{id}/?key=... after payment; the
 * $order it hands over replaces the old /api/orders lookup, and the download
 * links are WooCommerce's own token-gated ones.
 *
 * @var WC_Order $order
 */
if (!defined('ABSPATH')) exit;

$paid = $order && !$order->has_status(array('failed', 'cancelled', 'pending'));
$downloads = $paid ? $order->get_downloadable_items() : array();
$currency = $order ? $order->get_currency() : get_woocommerce_currency();
$symbol = html_entity_decode(get_woocommerce_currency_symbol($currency), ENT_QUOTES, 'UTF-8');
$money = function ($amount) use ($symbol) { return $symbol . number_format((float) $amount, 2); };
?>
<section aria-labelledby="order-h" style="position: relative; padding: clamp(104px, 14vh, 160px) clamp(18px, 3.4vw, 54px) clamp(60px, 9vh, 110px);">

  <?php if (!$order): ?>
  <div style="max-width: 560px;">
    <p style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Order</p>
    <h1 id="order-h" style="margin: 10px 0 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(32px, 4vw, 56px); line-height: 1.05;">This order link is invalid <em style="font-style: italic; font-weight: 400;">or has expired.</em></h1>
    <p style="margin: 0 0 26px; font-size: 14.5px; line-height: 1.75; color: #5F5A54;">Double-check the link from your confirmation, or head back to the catalog to start again.</p>
    <a data-magnetic="" href="/palettes/" style="display: inline-flex; align-items: center; padding: 17px 30px; border: 0; border-radius: 999px; background: #292825; color: #F5F2EA; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; box-shadow: 0 18px 34px rgba(41,40,37,.16); transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #3F3D37;">Browse palettes</a>
  </div>

  <?php elseif (!$paid): ?>
  <div style="max-width: 560px;">
    <p style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Order #<?php echo esc_html($order->get_order_number()); ?></p>
    <h1 id="order-h" style="margin: 10px 0 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(32px, 4vw, 56px); line-height: 1.05;">Your payment <em style="font-style: italic; font-weight: 400;">didn't go through.</em></h1>
    <p style="margin: 0 0 26px; font-size: 14.5px; line-height: 1.75; color: #5F5A54;">Nothing has been charged. You can try again with a different card, or write to us if you think this is a mistake.</p>
    <a data-magnetic="" href="<?php echo esc_url($order->get_checkout_payment_url()); ?>" style="display: inline-flex; align-items: center; padding: 17px 30px; border: 0; border-radius: 999px; background: #292825; color: #F5F2EA; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; box-shadow: 0 18px 34px rgba(41,40,37,.16); transition: transform .45s cubic-bezier(.22,1,.36,1), background .35s ease;" style-hover="background: #3F3D37;">Try payment again</a>
  </div>

  <?php else: ?>
  <div style="max-width: 620px; margin-bottom: clamp(36px, 5vh, 56px);">
    <p style="margin: 0; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #78736E;">Order confirmed</p>
    <h1 id="order-h" style="margin: 10px 0 14px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(34px, 4.6vw, 68px); line-height: 1.02;">Thank you — it's <em style="font-style: italic; font-weight: 400;">all yours.</em></h1>
    <?php if ($downloads): ?>
    <p style="margin: 0; font-size: 14.5px; line-height: 1.75; color: #5F5A54;">Your files are ready below — no waiting, nothing to ship. A copy of these links is in your confirmation email, so you can come back for your downloads anytime.</p>
    <?php else: ?>
    <p style="margin: 0; font-size: 14.5px; line-height: 1.75; color: #5F5A54;">We're preparing your files — your download links will be in your confirmation email at <?php echo esc_html($order->get_billing_email()); ?> within a few minutes.</p>
    <?php endif; ?>
    <p data-order-meta="" style="margin: 14px 0 0; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #A9A29A;">Order #<?php echo esc_html($order->get_order_number()); ?> · <?php echo esc_html(wc_format_datetime($order->get_date_created(), 'F j, Y')); ?></p>
  </div>

  <div data-order-items="" style="display: flex; flex-direction: column; gap: 0; max-width: 760px; border-top: 1px solid #292825;">
    <?php foreach ($order->get_items() as $item_id => $item): ?>
    <?php
      $qty = $item->get_quantity();
      $files = array_filter($downloads, function ($d) use ($item_id) { return (int) $d['order_item_id'] === (int) $item_id; });
    ?>
    <div style="display: flex; flex-direction: column; gap: 14px; padding: 24px 0; border-bottom: 1px solid #D8D2C8;">
      <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 14px;">
        <h2 style="margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: clamp(20px, 1.8vw, 27px); line-height: 1;"><?php echo esc_html($item->get_name()); ?><?php echo $qty > 1 ? ' × ' . (int) $qty : ''; ?></h2>
        <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18px; white-space: nowrap;"><?php echo esc_html($money($item->get_total())); ?></span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <?php if ($files): foreach ($files as $file): ?>
        <a href="<?php echo esc_url($file['download_url']); ?>" style="display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 18px; background: #EDEAE0; text-decoration: none; color: inherit; transition: background .3s ease;" style-hover="background: #E3DED3;">
          <span style="font-size: 13px;"><?php echo esc_html($file['download_name']); ?></span>
          <span style="display: flex; align-items: center; gap: 10px; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: #78736E;">
            <?php if (!empty($file['downloads_remaining']) && $file['downloads_remaining'] !== ''): ?><span><?php echo esc_html($file['downloads_remaining']); ?> left</span><?php endif; ?>
            <span style="color: #292825;">Download ↓</span>
          </span>
        </a>
        <?php endforeach; else: ?>
        <p style="margin:0; font-size: 12.5px; color: #A9A29A;">Download links for this item will arrive by email.</p>
        <?php endif; ?>
      </div>
    </div>
    <?php endforeach; ?>
  </div>

  <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 760px; padding: 22px 0; margin-top: 4px; border-top: 1px solid #D8D2C8;">
    <span style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px;">Total paid</span>
    <span data-order-total="" style="font-family: 'Cormorant Garamond', Georgia, serif; font-size: clamp(24px, 2.4vw, 32px);"><?php echo esc_html($money($order->get_total())); ?></span>
  </div>

  <a data-magnetic="" href="/palettes/" style="display: inline-flex; align-items: center; margin-top: clamp(28px, 4vh, 44px); padding: 17px 30px; border: 1px solid #D8D2C8; border-radius: 999px; background: transparent; font-size: 12px; font-weight: 500; letter-spacing: .16em; text-transform: uppercase; transition: background .35s ease, transform .45s cubic-bezier(.22,1,.36,1);" style-hover="background: #EDEAE0;">Keep exploring palettes</a>
  <?php endif; ?>
</section>
