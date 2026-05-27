(function () {
  "use strict";

  var pendingForm = null;
  var modalEl = null;
  var modalInstance = null;

  function getModal() {
    if (!modalEl) modalEl = document.getElementById("suspendConfirmModal");
    if (modalEl && !modalInstance && window.bootstrap) {
      modalInstance = new bootstrap.Modal(modalEl);
    }
    return modalInstance;
  }

  function openForForm(form) {
    pendingForm = form;
    var modal = getModal();
    if (modal) modal.show();
  }

  function init() {
    var submitBtn = document.getElementById("suspendConfirmModalSubmit");
    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        if (pendingForm) {
          pendingForm.submit();
          pendingForm = null;
        }
        var modal = getModal();
        if (modal) modal.hide();
      });
    }

    if (modalEl) {
      modalEl.addEventListener("hidden.bs.modal", function () {
        pendingForm = null;
      });
    }

    document.querySelectorAll(".admin-suspend-form").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        openForForm(form);
      });
    });

    document.querySelectorAll(".js-suspend-confirm-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var form = btn.closest(".admin-suspend-form");
        if (form) openForForm(form);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
