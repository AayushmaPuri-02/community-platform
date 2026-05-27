(function (root) {
  function startOfDay(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatAlertDate(createdAt) {
    var date = new Date(createdAt);
    if (isNaN(date.getTime())) return "";

    var now = new Date();
    var diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    var diffMins = Math.floor(diffMs / 60000);
    var diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) {
      return diffMins + (diffMins === 1 ? " minute" : " minutes") + " ago";
    }
    if (diffHours < 24) {
      return diffHours + (diffHours === 1 ? " hour" : " hours") + " ago";
    }

    var today = startOfDay(now);
    var createdDay = startOfDay(date);
    var dayDiff = Math.round((today - createdDay) / 86400000);

    if (dayDiff === 1) return "Yesterday";
    if (dayDiff === 2) return "2 days ago";

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  root.formatAlertDate = formatAlertDate;
})(typeof window !== "undefined" ? window : globalThis);
