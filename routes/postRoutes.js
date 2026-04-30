const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const postController = require("../controllers/postController");
const { canCreatePost, isLoggedIn } = require("../middleware/authMiddleware");
const multer = require("multer");
const { imageStorage } = require("../cloudConfig");
const upload = multer({ storage: imageStorage });
const Post = require("../models/Post");
const User = require("../models/User");
const { uploadImage } = require("../middleware/upload");
const { createNotification } = require("../utils/notifications");

router.get("/posts/create", canCreatePost, postController.getCreatePost);
router.get("/posts/:id", postController.getPostById);

// GET /api/alerts — JSON list of alert posts with valid coordinates
router.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await Post.find({
      type: "alert",
      latitude: { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null },
    })
      .populate("author", "fullName organizationName communityName")
      .sort({ createdAt: -1 })
      .select("_id title description alertCategory alertRadius alertStatus locationName latitude longitude createdAt author");

    const data = alerts.map(post => ({
      _id: post._id,
      title: post.title,
      description: post.description,
      alertCategory: post.alertCategory || "",
      alertRadius: post.alertRadius || "",
      alertStatus: post.alertStatus || "Active",
      locationName: post.locationName || "",
      latitude: post.latitude,
      longitude: post.longitude,
      createdAt: post.createdAt,
      authorName: post.author
        ? (post.author.communityName || post.author.organizationName || post.author.fullName || "Unknown")
        : "Unknown",
    }));

    return res.json(data);
  } catch (err) {
    console.error("GET /api/alerts error:", err);
    return res.status(500).json({ error: "Failed to load alerts" });
  }
});
router.post("/posts/:id/comments", isLoggedIn, postController.createComment);
router.post("/posts/:postId/comments/:commentId/reply", isLoggedIn, postController.createReply);
router.post("/comments/:id/delete", isLoggedIn, postController.deleteComment);
router.get("/comments/:id/edit", isLoggedIn, postController.getEditComment);
router.post("/comments/:id/edit", isLoggedIn, postController.updateComment);

router.post("/comments/:id/pin", isLoggedIn, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).populate("post");

    if (!comment) {
      return res.send("Comment not found");
    }

    // Only post owner can pin/unpin
    if (comment.post.author.toString() !== req.session.userId) {
      return res.send("Not authorized");
    }

    if (comment.isPinned) {
      // UNPIN
      comment.isPinned = false;
      await comment.save();
    } else {
      // UNPIN all other comments on this post
      await Comment.updateMany(
        { post: comment.post._id },
        { isPinned: false }
      );

      // PIN this one
      comment.isPinned = true;
      await comment.save();
    }

    return res.redirect(`/posts/${comment.post._id}`);
  } catch (err) {
    console.log(err);
    return res.send("Error updating pin");
  }
});



router.post("/posts", canCreatePost, (req, res, next) => {
  uploadImage.array("postImages", 4)(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        req.flash("error", "Each image must be 1.5 MB or less");
        return res.redirect("/posts/create");
      }

      if (err.code === "INVALID_IMAGE_TYPE") {
        req.flash("error", "Only JPG, JPEG, and PNG image files are allowed");
        return res.redirect("/posts/create");
      }

      req.flash("error", "Error uploading images");
      return res.redirect("/posts/create");
    }

    next();
  });
}, postController.createPost);

router.post("/posts/:id/delete", isLoggedIn, postController.deletePost);

router.get("/posts/:id/edit", isLoggedIn, postController.getEditPost);

router.post("/posts/:id/edit", isLoggedIn, (req, res, next) => {
  uploadImage.array("postImages", 4)(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        req.flash("error", "Each image must be 1.5 MB or less");
        return res.redirect(`/posts/${req.params.id}/edit`);
      }

      if (err.code === "INVALID_IMAGE_TYPE") {
        req.flash("error", "Only JPG, JPEG, and PNG image files are allowed");
        return res.redirect(`/posts/${req.params.id}/edit`);
      }

      req.flash("error", "Error uploading images");
      return res.redirect(`/posts/${req.params.id}/edit`);
    }

    next();
  });
}, postController.updatePost);


router.post("/posts/:id/like", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const userId = req.session.userId;
    const alreadyLiked = post.likes.some(id => id.toString() === userId.toString());

    if (alreadyLiked) {
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
    } else {
      post.likes.push(userId);
    }

    await post.save();

    return res.json({
      success: true,
      liked: !alreadyLiked,
      likeCount: post.likes.length
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Error liking post" });
  }
});


router.post("/posts/:id/save", isLoggedIn, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.session.userId;

    // Verify the post exists
    const post = await Post.findById(postId).select("_id");
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // Check current saved state without loading the full document
    const user = await User.findById(userId).select("savedPosts");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const alreadySaved = user.savedPosts.some(
      id => id.toString() === postId.toString()
    );

    if (alreadySaved) {
      // Atomic remove — no pre-save hooks triggered
      await User.findByIdAndUpdate(userId, { $pull: { savedPosts: post._id } });
    } else {
      // Atomic add — $addToSet prevents duplicates
      await User.findByIdAndUpdate(userId, { $addToSet: { savedPosts: post._id } });
    }

    return res.json({ success: true, saved: !alreadySaved });
  } catch (err) {
    console.error("SAVE ROUTE ERROR:", err);
    return res.status(500).json({ success: false, message: "Error saving post" });
  }
});




// POST /posts/:id/volunteer — join as volunteer
router.post("/posts/:id/volunteer", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.type !== "volunteer") {
      req.flash("error", "Post not found or not a volunteer post");
      return res.redirect("/home");
    }

    // Author cannot join their own post
    if (post.author.toString() === req.session.userId.toString()) {
      req.flash("error", "You cannot volunteer for your own post");
      return res.redirect(`/posts/${post._id}`);
    }

    // Duplicate check
    const alreadyJoined = post.volunteers.some(
      v => v.user && v.user.toString() === req.session.userId.toString()
    );
    if (alreadyJoined) {
      req.flash("error", "You have already signed up as a volunteer");
      return res.redirect(`/posts/${post._id}`);
    }

    // Slot limit check
    if (post.maxVolunteers > 0 && post.volunteers.length >= post.maxVolunteers) {
      req.flash("error", "Volunteer slots are full");
      return res.redirect(`/posts/${post._id}`);
    }

    const { fullName, phone, note } = req.body;

    if (!fullName || !fullName.trim()) {
      req.flash("error", "Full name is required");
      return res.redirect(`/posts/${post._id}`);
    }

    const nepalPhoneRegex = /^(97|98)\d{8}$/;
    if (!phone || !nepalPhoneRegex.test(phone.trim())) {
      req.flash("error", "Enter a valid Nepal mobile number (starts with 97 or 98, 10 digits)");
      return res.redirect(`/posts/${post._id}`);
    }

    post.volunteers.push({
      user: req.session.userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      note: note ? note.trim() : "",
      joinedAt: new Date(),
      attended: false,
      status: "pending",
    });

    await post.save();
    req.flash("success", "You have successfully signed up as a volunteer");
    return res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error signing up as volunteer");
    return res.redirect("/home");
  }
});

// POST /posts/:id/volunteer/:volunteerId/attend — mark attendance (author only)
router.post("/posts/:id/volunteer/:volunteerId/attend", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.flash("error", "Post not found");
      return res.redirect("/home");
    }

    if (post.author.toString() !== req.session.userId.toString()) {
      req.flash("error", "Only the post author can mark attendance");
      return res.redirect(`/posts/${post._id}`);
    }

    const volunteer = post.volunteers.id(req.params.volunteerId);
    if (!volunteer) {
      req.flash("error", "Volunteer entry not found");
      return res.redirect(`/posts/${post._id}`);
    }

    // Date check — can only mark on or after volunteer date
    if (post.volunteerDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vDate = new Date(post.volunteerDate);
      vDate.setHours(0, 0, 0, 0);
      if (today < vDate) {
        req.flash("error", "Attendance can only be marked on or after the volunteer date");
        return res.redirect(`/posts/${post._id}`);
      }
    }

    // Already attended — cannot undo
    if (volunteer.status === "attended") {
      req.flash("info", "Attendance already marked and cannot be undone");
      return res.redirect(`/posts/${post._id}`);
    }

    // Mark attended — permanent
    volunteer.attended = true;
    volunteer.status = "attended";
    await post.save();

    // Increment volunteerCount once
    if (volunteer.user) {
      await User.findByIdAndUpdate(volunteer.user, { $inc: { volunteerCount: 1 } });

      // Notify the volunteer
      await createNotification(
        volunteer.user,
        `Your attendance has been marked for "${post.title}"`,
        `/posts/${post._id}`
      );
    }

    req.flash("success", "Attendance marked");

    // Redirect back to dashboard if action came from there
    const attendRedirect = req.body.fromDashboard === "1"
      ? (req.session.role === "organization" ? "/org-dashboard" : "/community-dashboard")
      : `/posts/${post._id}`;

    return res.redirect(attendRedirect);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error updating attendance");
    return res.redirect("/home");
  }
});

// POST /posts/:id/volunteer/cancel — user cancels their own signup
router.post("/posts/:id/volunteer/cancel", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.type !== "volunteer") {
      req.flash("error", "Post not found");
      return res.redirect("/home");
    }

    // 2-day cutoff rule
    if (post.volunteerDate) {
      const cutoff = new Date(post.volunteerDate);
      cutoff.setDate(cutoff.getDate() - 2);
      cutoff.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (today >= cutoff) {
        req.flash("error", "You can no longer cancel — cancellation is not allowed within 2 days of the volunteer date");
        return res.redirect(`/posts/${post._id}`);
      }
    }

    const entryIndex = post.volunteers.findIndex(
      v => v.user && v.user.toString() === req.session.userId.toString()
    );

    if (entryIndex === -1) {
      req.flash("error", "You are not signed up for this post");
      return res.redirect(`/posts/${post._id}`);
    }

    post.volunteers.splice(entryIndex, 1);
    await post.save();

    req.flash("success", "Your volunteer signup has been cancelled");
    return res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error cancelling volunteer signup");
    return res.redirect("/home");
  }
});

// POST /posts/:id/volunteer/:volunteerId/reject — author rejects a volunteer
router.post("/posts/:id/volunteer/:volunteerId/reject", isLoggedIn, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      req.flash("error", "Post not found");
      return res.redirect("/home");
    }

    if (post.author.toString() !== req.session.userId.toString()) {
      req.flash("error", "Only the post author can reject volunteers");
      return res.redirect(`/posts/${post._id}`);
    }

    const volunteer = post.volunteers.id(req.params.volunteerId);
    if (!volunteer) {
      req.flash("error", "Volunteer entry not found");
      return res.redirect(`/posts/${post._id}`);
    }

    const reason = req.body.rejectionReason ? req.body.rejectionReason.trim() : "";
    if (!reason) {
      req.flash("error", "A rejection reason is required");
      return res.redirect(`/posts/${post._id}`);
    }

    volunteer.status = "rejected";
    volunteer.rejectionReason = reason;
    await post.save();

    // Notify the volunteer
    if (volunteer.user) {
      await createNotification(
        volunteer.user,
        `Your volunteer application for "${post.title}" was not accepted`,
        `/posts/${post._id}`
      );
    }

    // Determine redirect — dashboard or post page
    const redirectTo = req.body.fromDashboard === "1"
      ? (req.session.role === "organization" ? "/org-dashboard" : "/community-dashboard")
      : `/posts/${post._id}`;

    req.flash("info", "Volunteer rejected");
    return res.redirect(redirectTo);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error rejecting volunteer");
    return res.redirect("/home");
  }
});

module.exports = router;
