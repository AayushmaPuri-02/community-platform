const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const User = require("../models/User");
const { uploadImage } = require("../middleware/upload");

// GET edit profile
router.get("/edit", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.session.userId);
  
 res.render("profile/edit", {
  title: "Edit Profile",
  user,
  role: user.role,
  hideSidebar: !req.session.profileCompleted
});
});

router.post("/edit", isLoggedIn, (req, res, next) => {
  uploadImage.single("profileImage")(req, res, function (err) {
 if (err) {
  if (err.code === "LIMIT_FILE_SIZE") {
    req.flash("error", "Image size must be 1.5 MB or less");
    return res.redirect("/profile/edit");
  }

  if (err.code === "INVALID_IMAGE_TYPE") {
    req.flash("error", "Only JPG, JPEG, and PNG image files are allowed");
    return res.redirect("/profile/edit");
  }

  req.flash("error", "Error uploading image");
  return res.redirect("/profile/edit");
}

    next();
  });
}, async (req, res) => {
  const user = await User.findById(req.session.userId);

  if (!user) {
    req.flash("error", "User not found");
    return res.redirect("/login");
  }

  // ===== CITIZEN PROFILE UPDATE =====
  if (user.role === "citizen") {
    const { fullName, email, location } = req.body;

    const trimmedFullName = fullName ? fullName.trim() : "";
    const trimmedEmail = email ? email.trim() : "";
    const trimmedLocation = location ? location.trim() : "";

    if (!trimmedFullName || !trimmedEmail) {
      req.flash("error", "Full name and email are required");
      return res.redirect("/profile/edit");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      req.flash("error", "Enter a valid email address");
      return res.redirect("/profile/edit");
    }

    const updateData = {
      fullName: trimmedFullName,
      email: trimmedEmail,
      location: trimmedLocation,
    };

    if (req.file) {
      updateData.profileImage = req.file.path;
    }

    await User.findByIdAndUpdate(req.session.userId, updateData);

    req.session.fullName = trimmedFullName;

    req.flash("success", "Profile updated successfully");
    return res.redirect(`/users/${req.session.userId}`);
  }

  // ===== ORGANIZATION / COMMUNITY ADMIN PROFILE UPDATE =====
  const { bio, contactInfo, socialMediaLink } = req.body;

  const trimmedBio = bio ? bio.trim() : "";
  const trimmedContactInfo = contactInfo ? contactInfo.trim() : "";
  const trimmedSocialMediaLink = socialMediaLink ? socialMediaLink.trim() : "";

  if (
    (user.role === "organization" || user.role === "communityAdmin") &&
    (!trimmedBio || !trimmedContactInfo)
  ) {
    req.flash("error", "Bio and contact info are required to complete your profile");
    return res.redirect("/profile/edit");
  }

  if (trimmedBio.length > 300) {
    req.flash("error", "Bio must be 300 characters or less");
    return res.redirect("/profile/edit");
  }

  if (trimmedContactInfo.length > 150) {
    req.flash("error", "Contact info must be 150 characters or less");
    return res.redirect("/profile/edit");
  }

  if (
    trimmedSocialMediaLink &&
    !trimmedSocialMediaLink.startsWith("http://") &&
    !trimmedSocialMediaLink.startsWith("https://")
  ) {
    req.flash("error", "Social media link must start with http:// or https://");
    return res.redirect("/profile/edit");
  }

  const updateData = {
    bio: trimmedBio,
    contactInfo: trimmedContactInfo,
    socialMediaLink: trimmedSocialMediaLink,
    profileCompleted: true,
  };

  if (req.file) {
    updateData.profileImage = req.file.path;
  }

  await User.findByIdAndUpdate(req.session.userId, updateData);
  req.session.profileCompleted = true;

  req.flash("success", "Profile updated successfully");
  return res.redirect(`/users/${req.session.userId}`);
  
});


module.exports = router;