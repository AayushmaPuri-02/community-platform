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

router.get("/posts/create", canCreatePost, postController.getCreatePost);
router.get("/posts/:id", postController.getPostById);
router.post("/posts/:id/comments", isLoggedIn, postController.createComment);
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
    const user = await User.findById(req.session.userId);
    const postId = req.params.id;

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const alreadySaved = user.savedPosts.some(
      id => id.toString() === postId.toString()
    );

    if (alreadySaved) {
      user.savedPosts = user.savedPosts.filter(
        id => id.toString() !== postId.toString()
      );
    } else {
      user.savedPosts.push(postId);
    }

    await user.save();

    return res.json({
      success: true,
      saved: !alreadySaved
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Error saving post" });
  }
});


module.exports = router;
