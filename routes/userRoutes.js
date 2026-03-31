const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");

//this is for the profile section of the user

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.send("User not found");
    }

    const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });

    let isFollowing = false;

    if (req.session.userId) {
      const existingFollow = await Follow.findOne({
        follower: req.session.userId,
        following: user._id,
      });

      isFollowing = !!existingFollow;
    }

    let backUrl = null;

    if (req.query.from === "following") {
      backUrl = "/following";
    }

    if (req.query.from === "followers") {
      backUrl = "/following";
    }

    res.render("users/show", {
      title: user.organizationName || user.fullName,
      user,
      posts,
      isFollowing,
      backUrl,
    });
  } catch (err) {
    console.log(err);
    return res.send("Error loading profile");
  }
});

module.exports = router;