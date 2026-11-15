/* Simple Income Protection: consent config (CookieConsent v3 + Google Consent Mode v2).
   Replaces the Complianz plugin. Self-hosted, no third party. Same design as simplelifecover.com.
   - The Consent Mode v2 default (all denied) is set in <head> before GTM loads; this file flips it on consent.
   - Each first consent / change is POSTed to /consent-log for the audit trail (Workers Logs). */
(function () {
  var POLICY_VERSION = "1.0";

  function gtagUpdate(cats) {
    if (typeof gtag !== "function") return;
    var analytics = cats.indexOf("analytics") !== -1 ? "granted" : "denied";
    var marketing = cats.indexOf("marketing") !== -1 ? "granted" : "denied";
    gtag("consent", "update", {
      analytics_storage: analytics,
      ad_storage: marketing,
      ad_user_data: marketing,
      ad_personalization: marketing,
    });
  }

  function logConsent(cookie, kind) {
    try {
      fetch("/consent-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          ts: new Date().toISOString(),
          event: kind,
          consentId: cookie && cookie.consentId,
          revision: cookie && cookie.revision,
          categories: (cookie && cookie.categories) || [],
          policyVersion: POLICY_VERSION,
          url: location.pathname,
        }),
      });
    } catch (e) {}
  }

  if (typeof CookieConsent === "undefined") return;

  CookieConsent.run({
    guiOptions: {
      consentModal: { layout: "bar inline", position: "bottom", flipButtons: false, equalWeightButtons: true },
      preferencesModal: { layout: "box", position: "right", flipButtons: false, equalWeightButtons: true },
    },
    categories: {
      necessary: { readOnly: true, enabled: true },
      functional: {},
      analytics: {},
      marketing: {},
    },
    onFirstConsent: function (p) { gtagUpdate(p.cookie.categories); logConsent(p.cookie, "first_consent"); },
    onConsent: function (p) { gtagUpdate(p.cookie.categories); },
    onChange: function (p) { gtagUpdate(p.cookie.categories); logConsent(p.cookie, "change"); },
    language: {
      default: "en",
      translations: {
        en: {
          consentModal: {
            title: "We value your privacy",
            description:
              "We use cookies to run this site, measure performance and support our advertising. You can accept all, reject non-essential, or choose which to allow. Your choice is saved and can be changed at any time.",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject non-essential",
            showPreferencesBtn: "Manage preferences",
            footer: '<a href="/privacy-policy/">Privacy Policy</a> · <a href="/cookie-policy/">Cookie Policy</a>',
          },
          preferencesModal: {
            title: "Manage cookie preferences",
            acceptAllBtn: "Accept all",
            acceptNecessaryBtn: "Reject non-essential",
            savePreferencesBtn: "Save preferences",
            closeIconLabel: "Close",
            sections: [
              { title: "Your privacy choices", description: "Choose which categories of cookies you allow. Necessary cookies are always on because the site cannot work without them." },
              { title: "Strictly necessary", description: "Required for the website and the form to function. Always active.", linkedCategory: "necessary" },
              { title: "Functional", description: "Remember your choices and preferences to improve your experience.", linkedCategory: "functional" },
              { title: "Analytics", description: "Help us understand how visitors use the site so we can improve it.", linkedCategory: "analytics" },
              { title: "Marketing", description: "Used to measure and improve our advertising, including Google Ads conversion tracking.", linkedCategory: "marketing" },
              { title: "More information", description: 'See our <a href="/cookie-policy/">Cookie Policy</a> and <a href="/privacy-policy/">Privacy Policy</a>.' },
            ],
          },
        },
      },
    },
  });
})();
