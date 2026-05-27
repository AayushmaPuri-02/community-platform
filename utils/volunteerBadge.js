/**
 * Returns badge metadata for a citizen based on volunteerCount, or null if no badge.
 * @param {object|number} userOrCount - User document (with role + volunteerCount) or a count
 */
function getVolunteerBadge(userOrCount) {
  if (userOrCount && typeof userOrCount === "object") {
    if (userOrCount.role && userOrCount.role !== "citizen") {
      return null;
    }
  }

  const count =
    userOrCount && typeof userOrCount === "object"
      ? userOrCount.volunteerCount || 0
      : userOrCount || 0;

  if (count >= 20) {
    return { level: "diamond", color: "#6EE7F9", title: "Diamond Volunteer" };
  }
  if (count >= 10) {
    return { level: "gold", color: "#D4AF37", title: "Gold Volunteer" };
  }
  if (count >= 5) {
    return { level: "silver", color: "#C0C0C0", title: "Silver Volunteer" };
  }
  if (count >= 1) {
    return { level: "bronze", color: "#CD7F32", title: "Bronze Volunteer" };
  }
  return null;
}

module.exports = { getVolunteerBadge };
