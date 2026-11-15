/* Equity Advisor: carry Google Ads tracking into the VM form's hidden fields.
   The campaign tracking template appends vv* params to the landing URL. On the old WordPress site the VM Forms
   plugin copied them into the hidden tracking fields server-side; the static site has no PHP, so it is done here.
   Only params PRESENT in the URL are applied and an already-populated field is never overwritten.
   (Copied from simplelifecover.com, with extension id and device added: both exist on this form.) */
(function () {
  try {
    var qp = new URLSearchParams(window.location.search);
    var MAP = {
      vvadid: "vmform_mi_adid",
      vvadgroupid: "vmform_mi_adgroupid",
      vvkeywordid: "vmform_mi_keywordid",
      vvmatchtype: "vmform_mi_matchtype",
      vvextensionid: "vmform_mi_extensionid",
      vvdevice: "vmform_mi_device"
    };
    function apply() {
      Object.keys(MAP).forEach(function (k) {
        var v = qp.get(k);
        if (v === null || v === "") return;
        var el = document.querySelector('input[name="' + MAP[k] + '"]');
        if (el && !el.value) el.value = v;
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", apply);
    } else {
      apply();
    }
  } catch (e) {}
})();
