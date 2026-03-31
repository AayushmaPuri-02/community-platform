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
  user
});
});

// POST update profile
router.post("/edit", isLoggedIn, uploadImage.single("profileImage"), async (req, res) => {
  const { bio, contactInfo, socialMediaLink } = req.body;

  const user = await User.findById(req.session.userId);

  if (!user) {
    return res.send("User not found");
  }

  if (
    (user.role === "organization" || user.role === "communityAdmin") &&
    (!bio || !contactInfo)
  ) {
    return res.send("Bio and contact info are required to complete your profile");
  }

  const updateData = {
    bio,
    contactInfo,
    socialMediaLink,
    profileCompleted: true,
  };

  // save uploaded image URL if file exists
  if (req.file) {
    updateData.profileImage = req.file.path;
  }

  await User.findByIdAndUpdate(req.session.userId, updateData);

  return res.redirect("/");
});


module.exports = router;