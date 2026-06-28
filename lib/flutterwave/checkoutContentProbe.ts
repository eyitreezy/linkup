/** Injected after load — posts whether Flutterwave checkout rendered meaningful content. */
export const FLUTTERWAVE_CONTENT_PROBE_JS = `
(function () {
  function probe() {
    try {
      var body = document.body;
      var text = (body && body.innerText ? body.innerText : '').replace(/\\s+/g, ' ').trim();
      var hasForm = !!document.querySelector('form, input, button, iframe, [role="button"]');
      var ok = text.length > 24 || hasForm;
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'flw-content', ok: ok }));
    } catch (e) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'flw-content', ok: false }));
    }
  }
  probe();
  setTimeout(probe, 800);
  setTimeout(probe, 2200);
})();
true;
`;

export type FlutterwaveContentProbeMessage = {
  type: 'flw-content';
  ok: boolean;
};

export function parseFlutterwaveContentProbe(raw: string): FlutterwaveContentProbeMessage | null {
  try {
    const parsed = JSON.parse(raw) as FlutterwaveContentProbeMessage;
    if (parsed?.type === 'flw-content' && typeof parsed.ok === 'boolean') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}
