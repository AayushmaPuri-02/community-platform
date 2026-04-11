module.exports.isLoggedIn = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
};

module.exports.isOrganization = (req, res, next) => {
  if (req.session.role !== "organization") {
    req.flash("error", "Access denied: Organization only");
    return res.redirect("/");
  }
  next();
};

module.exports.canCreatePost = (req, res, next) => {
  if (!req.session.userId) {
    req.flash("error", "You must be logged in first");
    return res.redirect("/login");
  }

  const allowedRoles = ["organization", "communityAdmin"];

  if (!allowedRoles.includes(req.session.role)) {
    req.flash("error", "Only organizations and community admins can create posts");
    return res.redirect("/");
  }

  next();
};

module.exports.isLoggedOut = (req, res, next) => {
  if (req.session.userId) {
    // system admin should go to admin dashboard
    if (req.session.role === "systemAdmin") {
      return res.redirect("/admin");
    }

    // incomplete org/community admin should stay on profile setup
    if (
      (req.session.role === "organization" || req.session.role === "communityAdmin") &&
      !req.session.profileCompleted
    ) {
      return res.redirect("/profile/edit");
    }

    // everyone else goes home
    return res.redirect("/");
  }

  next();
};

module.exports.isSystemAdmin = (req, res, next) => {
  if (!req.session.userId) {
    req.flash("error", "You must be logged in first");
    return res.redirect("/login");
  }

  if (req.session.role !== "systemAdmin") {
    req.flash("error", "Access denied: System admin only");
    return res.redirect("/");
  }

  next();
};

module.exports.ensureProfileComplete = (req, res, next) => {
  if (
    req.session.userId &&
    (req.session.role === "organization" || req.session.role === "communityAdmin") &&
    !req.session.profileCompleted
  ) {
    return res.redirect("/profile/edit");
  }

  next();
};