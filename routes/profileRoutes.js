const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const { uploadImage } = require("../middleware/upload");
const profileController = require("../controllers/profileController");

router.get("/edit", isLoggedIn, profileController.getEditProfile);

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
}, profileController.postEditProfile);

module.exports = router;
