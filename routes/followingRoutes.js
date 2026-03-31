const express = require("express");
const router = express.Router();
const Follow = require("../models/Follow");
const { isLoggedIn } = require("../middleware/authMiddleware");

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const currentUserRole = req.session.role;

    // users I follow
    const follows = await Follow.find({ follower: currentUserId })
      .populate("following");

    const followingUsers = follows.map(f => f.following).filter(Boolean);

    let followerUsers = [];

    // only org/community admin can see followers
    if (currentUserRole === "organization" || currentUserRole === "communityAdmin") {
      const followers = await Follow.find({ following: currentUserId })
        .populate("follower");

      followerUsers = followers.map(f => f.follower).filter(Boolean);
    }

    res.render("following/index", {
      title: "Following",
      followingUsers,
      followerUsers,
      role: currentUserRole,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading following page");
  }
});

module.exports = router;