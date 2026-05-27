(function (root) {
  "use strict";

  function renderAlertStatus(status) {
    var isResolved = status === "Resolved";
    if (isResolved) {
      return (
        '<span class="alert-status-text alert-status-text--resolved">' +
        '<i class="bi bi-check-circle-fill" aria-hidden="true"></i>' +
        "<span>Resolved</span></span>"
      );
    }
    return (
      '<span class="alert-status-text alert-status-text--active">' +
      '<span class="alert-status-dot" aria-hidden="true"></span>' +
      "<span>Active</span></span>"
    );
  }

  root.renderAlertStatus = renderAlertStatus;
})(typeof window !== "undefined" ? window : global);
