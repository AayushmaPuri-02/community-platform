const { marked } = require("marked");

marked.setOptions({ breaks: true, gfm: true });

function getRegistrationDisplayName(user) {
  if (user.role === "communityAdmin") {
    return user.communityName || (user.location ? `${user.location} Locals` : "Community");
  }
  if (user.role === "organization") {
    return user.organizationName || "Organization";
  }
  return user.organizationName || user.communityName || user.fullName || "User";
}

function buildRecentActivityText(user) {
  const name = getRegistrationDisplayName(user);
  if (user.status === "approved") return `${name} was approved`;
  if (user.status === "rejected") return `${name} registration was rejected`;
  if (user.status === "pending") return `${name} submitted a registration request`;
  return `${name} registration was updated`;
}

function enrichPostsForPreview(posts) {
  return posts.map((post) => {
    const obj = post.toObject ? post.toObject() : { ...post };
    return {
      ...obj,
      renderedDescription: marked.parse(obj.description || ""),
    };
  });
}

function formatPostTypeLabel(type) {
  if (!type) return "Post";
  if (type === "communityUpdate") return "Community Update";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

module.exports = {
  getRegistrationDisplayName,
  buildRecentActivityText,
  enrichPostsForPreview,
  formatPostTypeLabel,
};
