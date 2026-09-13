/* The design pages express hover states as a style-hover="..." attribute
 * (their authoring tool applied it). Nothing in the browser reads that, so
 * this applies those declarations on hover and restores the original inline
 * style on leave. Keyboard focus gets the same treatment. */
(function () {
  if (matchMedia('(hover: none)').matches) return;
  var elements = document.querySelectorAll('[style-hover]');
  Array.prototype.forEach.call(elements, function (el) {
    var base = el.getAttribute('style') || '';
    var hover = el.getAttribute('style-hover') || '';
    var on = function () { el.setAttribute('style', base + ';' + hover); };
    var off = function () { el.setAttribute('style', base); };
    el.addEventListener('mouseenter', on);
    el.addEventListener('mouseleave', off);
    el.addEventListener('focus', on);
    el.addEventListener('blur', off);
  });
})();
