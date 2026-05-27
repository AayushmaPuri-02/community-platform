(function () {
  "use strict";

  function initPasswordToggle(wrap) {
    var input = wrap.querySelector("input");
    var btn = wrap.querySelector(".password-toggle-btn");
    if (!input || !btn) return;

    var icon = btn.querySelector(".bi");
    if (!icon) return;

    btn.addEventListener("click", function () {
      var isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      icon.classList.toggle("bi-eye", !isHidden);
      icon.classList.toggle("bi-eye-slash", isHidden);
      btn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
      input.focus();
    });
  }

  function initAll() {
    document.querySelectorAll(".password-toggle-wrap").forEach(initPasswordToggle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
