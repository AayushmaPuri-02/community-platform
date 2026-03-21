module.exports.isLoggedIn = (req, res, next) => {
  if (!req.session.userId) {
    return res.send("You must be logged in first");
  }
  next();
};

module.exports.isOrganization = (req, res, next) => {
  if (req.session.role !== "organization") {
    return res.send("Access denied: Organization only");
  }
  next();
};

module.exports.canCreatePost = (req, res, next) => {
  if (!req.session.userId) {
    return res.send("You must be logged in first");
  }

  const allowedRoles = ["organization", "communityAdmin"];

  if (!allowedRoles.includes(req.session.role)) {
    return res.send("Only organizations and community admins can create posts");
  }

  next();
};