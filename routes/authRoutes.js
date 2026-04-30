const express = require("express");
const router = express.Router();
const { isLoggedOut } = require("../middleware/authMiddleware");
const { uploadDocument, uploadRegistration } = require("../middleware/upload");
const authController = require("../controllers/authController");



router.get("/register", isLoggedOut, authController.getRegister);
// router.post("/register", isLoggedOut, authController.postRegister);
//the update route after using cloudinary
router.post(
  "/register",
  isLoggedOut,
  uploadRegistration,
  authController.postRegister
);
router.get("/login", isLoggedOut, authController.getLogin);
router.post("/login", isLoggedOut, authController.postLogin);

router.get("/logout", authController.logout);
router.get("/verify/:token", authController.verifyEmail);

router.get("/forgot-password", isLoggedOut, authController.getForgotPassword);
router.post("/forgot-password", isLoggedOut, authController.postForgotPassword);
router.get("/reset-password/:token", authController.getResetPassword);
router.post("/reset-password/:token", authController.postResetPassword);

module.exports = router;
