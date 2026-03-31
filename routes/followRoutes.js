const express = require("express");
const router = express.Router();
const Follow = require("../models/Follow");
const { isLoggedIn } = require("../middleware/authMiddleware");
const User = require("../models/User");

router.post("/:id/toggle", isLoggedIn, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.session.userId;

    // get target user
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.redirect(req.get("Referrer") || "/explore");
    }

    // ❌ prevent self follow
    if (targetUserId === currentUserId) {
      return res.redirect(req.get("Referrer") || "/explore");
    }

    // ❌ prevent following citizens
    if (targetUser.role === "citizen") {
      return res.redirect(req.get("Referrer") || "/explore");
    }

    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: targetUserId,
    });

    if (existingFollow) {
      await Follow.deleteOne({ _id: existingFollow._id });
    } else {
      await Follow.create({
        follower: currentUserId,
        following: targetUserId,
      });
    }

    return res.redirect(req.get("Referrer") || "/explore");
  } catch (err) {
    console.log(err);
    return res.send("Error toggling follow");
  }
});

module.exports = router;