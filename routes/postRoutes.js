const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");
const postController = require("../controllers/postController");
const { canCreatePost, isLoggedIn } = require("../middleware/authMiddleware");

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

router.post("/posts", canCreatePost, postController.createPost);
router.post("/posts/:id/delete", isLoggedIn, postController.deletePost);
router.get("/posts/:id/edit", isLoggedIn, postController.getEditPost);
router.post("/posts/:id/edit", isLoggedIn, postController.updatePost);


module.exports = router;
