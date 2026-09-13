<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ESZKJWSKN3"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-ESZKJWSKN3');
</script>

<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="p:domain_verify" content="af1dec66135345762a3ed52937049494"/>
<meta name="google-site-verification" content="T99QDxtNnuEmcAh0ZS1s0DaJmDg7W1_JUgjibWH7TxA" />
<?php if (is_front_page()): ?>
<link rel="preload" as="image" href="<?php echo DD_ASSETS; ?>/dd2-hero.webp" fetchpriority="high">
<?php endif; ?>
<?php wp_head(); ?>
<?php $dd_style = dd_page_meta('style'); if ($dd_style): ?>
<style>
<?php echo $dd_style; ?>
</style>
<?php endif; ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php
  $dd_count = dd_cart_count();
  $dd_home = is_front_page();
  // The homepage nav starts transparent over the hero and turns solid on
  // scroll (interactions.js initNav); every other page starts solid.
  $dd_nav_style = $dd_home
    ? 'padding: 22px clamp(18px, 3.4vw, 54px); color: #F5F2EA; background: rgba(245,242,234,0); border-bottom: 1px solid rgba(216,210,200,0);'
    : 'padding: 14px clamp(18px, 3.4vw, 54px); color: #292825; background: rgba(245,242,234,.9); border-bottom: 1px solid #D8D2C8; backdrop-filter: blur(14px);';
  $dd_cta_style = $dd_home
    ? 'border: 1px solid rgba(245,242,234,.5); background: rgba(245,242,234,.1);'
    : 'border: 1px solid #D8D2C8; background: rgba(255,255,255,.5);';
?>
<div style="position: relative; width: 100%; overflow-x: hidden; background: #F5F2EA;">

  <div data-progress="" style="position: fixed; top: 0; left: 0; height: 2px; width: 100%; background: #817A6E; transform: scaleX(0); transform-origin: 0 50%; z-index: 90; opacity: .5;"></div>

  <header data-nav="" style="position: fixed; top: 0; left: 0; right: 0; z-index: 80; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; <?php echo $dd_nav_style; ?> pointer-events: none; transition: background .5s ease, border-color .5s ease, backdrop-filter .5s ease, color .5s ease, padding .5s ease;">
    <a data-navlink="" href="<?php echo $dd_home ? '#top' : '/'; ?>" aria-label="Dwelling Dream home" style="pointer-events: auto; display: inline-flex; align-items: center; color: inherit;">
      <span style="position: relative; display: inline-block; height: clamp(38px, 4.4vw, 54px);">
        <img data-logo-light="" src="<?php echo DD_ASSETS; ?>/logo-mark-light.png" alt="Dwelling Dream" style="display: block; height: 100%; width: auto; transition: opacity .5s ease;<?php echo $dd_home ? '' : ' opacity: 0;'; ?>">
        <img data-logo-dark="" src="<?php echo DD_ASSETS; ?>/logo-mark.png" alt="" aria-hidden="true" style="position: absolute; left: 0; top: 0; display: block; height: 100%; width: auto; opacity: <?php echo $dd_home ? '0' : '1'; ?>; transition: opacity .5s ease;">
      </span>
    </a>
    <nav aria-label="Primary" style="pointer-events: auto; display: flex; align-items: center; gap: clamp(16px, 2.2vw, 36px);">
      <a data-navlink="" href="/" style="color: inherit; font-size: 13px; letter-spacing: .1em;">Home</a>
      <a data-navlink="" href="/about/" style="color: inherit; font-size: 13px; letter-spacing: .1em;">About</a>
      <a data-navlink="" href="/help/" style="color: inherit; font-size: 13px; letter-spacing: .1em;">Help</a>
      <a data-magnetic="" data-navcta="" href="/palettes/" style="display: inline-flex; align-items: center; padding: 11px 22px; <?php echo $dd_cta_style; ?> border-radius: 999px; color: inherit; font-size: 12px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; transition: background .35s ease, border-color .35s ease, color .35s ease, transform .45s cubic-bezier(.22,1,.36,1);" style-hover="background: #292825; color: #F5F2EA;">Explore Palettes</a>
      <details data-mobile-menu="" style="display: none; position: relative;">
        <summary aria-label="Open menu" style="list-style: none; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 1px solid currentColor; border-radius: 50%; cursor: pointer;">
          <span aria-hidden="true" style="display: flex; flex-direction: column; gap: 4px;">
            <span style="display: block; width: 16px; height: 1.5px; background: currentColor;"></span>
            <span style="display: block; width: 16px; height: 1.5px; background: currentColor;"></span>
            <span style="display: block; width: 16px; height: 1.5px; background: currentColor;"></span>
          </span>
        </summary>
        <div style="position: absolute; top: calc(100% + 12px); right: 0; min-width: 190px; display: flex; flex-direction: column; padding: 10px; background: #F5F2EA; border: 1px solid #D8D2C8; box-shadow: 0 24px 48px rgba(41,40,37,.18); z-index: 100;">
          <a href="/" style="padding: 10px 12px; color: #292825; font-size: 13px; letter-spacing: .05em; border-radius: 4px; transition: background .2s ease;" style-hover="background: #EDEAE0;">Home</a>
          <a href="/about/" style="padding: 10px 12px; color: #292825; font-size: 13px; letter-spacing: .05em; border-radius: 4px; transition: background .2s ease;" style-hover="background: #EDEAE0;">About</a>
          <a href="/help/" style="padding: 10px 12px; color: #292825; font-size: 13px; letter-spacing: .05em; border-radius: 4px; transition: background .2s ease;" style-hover="background: #EDEAE0;">Help</a>
          <a href="/palettes/" style="padding: 10px 12px; color: #292825; font-size: 13px; letter-spacing: .05em; border-radius: 4px; transition: background .2s ease;" style-hover="background: #EDEAE0;">Explore Palettes</a>
        </div>
      </details>
      <a data-cart="" href="/cart/" aria-label="Cart, <?php echo $dd_count; ?> <?php echo $dd_count === 1 ? 'item' : 'items'; ?>"<?php if (function_exists('is_cart') && is_cart()) echo ' aria-current="page"'; ?> style="position: relative; display: inline-flex; align-items: center; gap: 9px; padding: 11px 18px; border: 1px solid <?php echo (function_exists('is_cart') && is_cart()) ? '#292825' : 'transparent'; ?>; border-radius: 999px; background: <?php echo (function_exists('is_cart') && is_cart()) ? '#EDEAE0' : 'transparent'; ?>; color: inherit; font-size: 12px; font-weight: 500; letter-spacing: .14em; text-transform: uppercase; cursor: pointer; transition: background .35s ease, border-color .35s ease;">
        <span aria-hidden="true" style="display: inline-block; width: 13px; height: 11px; border: 1.5px solid currentColor; border-top: 0; border-radius: 0 0 3px 3px; position: relative; top: 2px;">
          <span style="position: absolute; left: 1.5px; right: 1.5px; top: -6px; height: 6px; border: 1.5px solid currentColor; border-bottom: 0; border-radius: 6px 6px 0 0;"></span>
        </span>
        <span data-cart-count=""><?php echo $dd_count; ?></span>
      </a>
    </nav>
  </header>
