const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const { uploadImage } = require("../middleware/upload");
const messageController = require("../controllers/messageController");

router.get("/", isLoggedIn, messageController.getInbox);
router.get("/:userId", isLoggedIn, messageController.getChat);
router.post("/:userId", isLoggedIn, (req, res, next) => {
  uploadImage.single("messageImage")(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        req.flash("error", "Image must be 1.5 MB or less");
        return res.redirect(`/messages/${req.params.userId}`);
      }
      if (err.code === "INVALID_IMAGE_TYPE") {
        req.flash("error", "Only JPG, JPEG, PNG, and WEBP image files are allowed");
        return res.redirect(`/messages/${req.params.userId}`);
      }
      req.flash("error", "Error uploading image");
      return res.redirect(`/messages/${req.params.userId}`);
    }
    next();
  });
}, messageController.sendMessage);
router.post("/:messageId/delete", isLoggedIn, messageController.deleteMessage);

module.exports = router;
