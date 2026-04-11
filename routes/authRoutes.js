const express = require("express");
const router = express.Router();
const { isLoggedOut } = require("../middleware/authMiddleware");
const {uploadDocument} = require("../middleware/upload");  //just added
const authController = require("../controllers/authController");



router.get("/register", isLoggedOut, authController.getRegister);
// router.post("/register", isLoggedOut, authController.postRegister);
//the update route after using cloudinary
router.post(
  "/register",
  isLoggedOut,
  uploadDocument.single("verificationDoc"),
  authController.postRegister
);
router.get("/login", isLoggedOut, authController.getLogin);
router.post("/login", isLoggedOut, authController.postLogin);

router.get("/logout", authController.logout);
router.get("/verify/:token", authController.verifyEmail);

module.exports = router;
