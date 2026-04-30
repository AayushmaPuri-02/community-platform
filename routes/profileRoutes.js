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
    hideSidebar: !req.session.profileCompleted,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
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
    const { fullName, email, location, locationName, homeLatitude, homeLongitude } = req.body;

    const trimmedFullName = fullName ? fullName.trim() : "";
    const trimmedEmail = email ? email.trim() : "";
    const trimmedLocation = location ? location.trim() : "";
    const trimmedLocationName = locationName ? locationName.trim() : "";
    const parsedLat = homeLatitude ? parseFloat(homeLatitude) : null;
    const parsedLng = homeLongitude ? parseFloat(homeLongitude) : null;

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
      location: trimmedLocationName || trimmedLocation,
    };

    if (trimmedLocationName && parsedLat && parsedLng) {
      updateData.locationName = trimmedLocationName;
      updateData.homeLatitude = parsedLat;
      updateData.homeLongitude = parsedLng;
    }

    if (req.file) {
      updateData.profileImage = req.file.path;
    }

    await User.findByIdAndUpdate(req.session.userId, updateData);
    req.session.fullName = trimmedFullName;

    req.flash("success", "Profile updated successfully");
    return res.redirect(`/users/${req.session.userId}`);
  }

  // ===== ORGANIZATION / COMMUNITY ADMIN PROFILE UPDATE =====
  const { bio, contactInfo, socialMediaLink, publicPhone, publicEmail, officeHours, locationName, homeLatitude, homeLongitude } = req.body;

  const trimmedBio = bio ? bio.trim() : "";
  const trimmedContactInfo = contactInfo ? contactInfo.trim() : "";
  const trimmedSocialMediaLink = socialMediaLink ? socialMediaLink.trim() : "";
  const trimmedPublicPhone = publicPhone ? publicPhone.trim() : "";
  const trimmedPublicEmail = publicEmail ? publicEmail.trim() : "";
  const trimmedOfficeHours = officeHours ? officeHours.trim() : "";
  const trimmedLocationName = locationName ? locationName.trim() : "";
  const parsedLat = homeLatitude ? parseFloat(homeLatitude) : null;
  const parsedLng = homeLongitude ? parseFloat(homeLongitude) : null;

  if (user.role === "organization" || user.role === "communityAdmin") {
    if (!trimmedBio) {
      req.flash("error", "Bio is required to complete your profile");
      return res.redirect("/profile/edit");
    }
    if (!trimmedPublicPhone) {
      req.flash("error", "Public phone number is required");
      return res.redirect("/profile/edit");
    }
    if (!trimmedPublicEmail) {
      req.flash("error", "Public email is required");
      return res.redirect("/profile/edit");
    }
  }

  const bioWordCount = trimmedBio ? trimmedBio.split(/\s+/).filter(Boolean).length : 0;
  if (bioWordCount > 150) {
    req.flash("error", "Bio must be 150 words or less");
    return res.redirect("/profile/edit");
  }

  // Validate phone: support multiple comma-separated numbers
  if (trimmedPublicPhone) {
    var phoneRegex = /^(97|98)\d{8}$|^01-?\d{7,8}$/;
    var phoneNumbers = trimmedPublicPhone.split(',').map(function (n) { return n.trim(); });
    var invalidPhone = phoneNumbers.find(function (n) { return !phoneRegex.test(n); });
    if (invalidPhone) {
      req.flash("error", "Invalid phone number: \"" + invalidPhone + "\". Use Nepal mobile (97/98...) or landline (01-...).");
      return res.redirect("/profile/edit");
    }
  }

  // Validate email
  if (trimmedPublicEmail) {
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedPublicEmail)) {
      req.flash("error", "Enter a valid public email address");
      return res.redirect("/profile/edit");
    }
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
    contactInfo: trimmedContactInfo || trimmedPublicPhone, // backward compat
    publicPhone: trimmedPublicPhone,
    publicEmail: trimmedPublicEmail,
    officeHours: trimmedOfficeHours,
    socialMediaLink: trimmedSocialMediaLink,
    profileCompleted: true,
  };

  // Save location coords if provided (communityAdmin: don't touch location/communityName)
  if (trimmedLocationName && parsedLat && parsedLng) {
    updateData.locationName = trimmedLocationName;
    updateData.homeLatitude = parsedLat;
    updateData.homeLongitude = parsedLng;
    if (user.role === "organization") {
      updateData.location = trimmedLocationName;
    }
  }

  if (req.file) {
    updateData.profileImage = req.file.path;
  }

  await User.findByIdAndUpdate(req.session.userId, updateData);
  req.session.profileCompleted = true;

  req.flash("success", "Profile updated successfully");
  return res.redirect(`/users/${req.session.userId}`);

});


module.exports = router;