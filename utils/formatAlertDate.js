function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Relative timestamp for time-sensitive alerts.
 * @param {Date|string|number} createdAt
 * @returns {string}
 */
function formatAlertDate(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) {
    return diffMins + (diffMins === 1 ? " minute" : " minutes") + " ago";
  }
  if (diffHours < 24) {
    return diffHours + (diffHours === 1 ? " hour" : " hours") + " ago";
  }

  const today = startOfDay(now);
  const createdDay = startOfDay(date);
  const dayDiff = Math.round((today - createdDay) / 86400000);

  if (dayDiff === 1) return "Yesterday";
  if (dayDiff === 2) return "2 days ago";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

module.exports = { formatAlertDate };
