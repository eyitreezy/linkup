/**
 * Injected into Flutterwave hosted checkout WebView so OTP/card steps fit narrow phones (≥320px).
 */
export const FLUTTERWAVE_CHECKOUT_VIEWPORT_JS = `
(function () {
  function apply() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
    );

    var styleId = 'linkup-flw-checkout-fit';
    var style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = [
      'html, body {',
      '  width: 100% !important;',
      '  max-width: 100vw !important;',
      '  min-width: 0 !important;',
      '  margin: 0 !important;',
      '  padding: 0 !important;',
      '  overflow-x: hidden !important;',
      '  -webkit-text-size-adjust: 100% !important;',
      '}',
      'body > *, main, section, form, [class*="container"], [class*="wrapper"],',
      '[class*="modal"], [class*="card"], [class*="content"] {',
      '  max-width: 100% !important;',
      '  box-sizing: border-box !important;',
      '}',
      'input, button, select, textarea {',
      '  max-width: 100% !important;',
      '  font-size: 16px !important;',
      '}',
      '@media (max-width: 360px) {',
      '  body { padding-left: 0 !important; padding-right: 0 !important; }',
      '}',
    ].join('\\n');
  }

  apply();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  }
  window.addEventListener('resize', apply);
  try {
    new MutationObserver(apply).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (e) {}
})();
true;
`;
