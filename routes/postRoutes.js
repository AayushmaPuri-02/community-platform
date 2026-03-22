const express = require("express");
const router = express.Router();

const postController = require("../controllers/postController");
const { canCreatePost, isLoggedIn } = require("../middleware/authMiddleware");

router.get("/posts/:id", postController.getPostById);
router.post("/posts/:id/comments", isLoggedIn, postController.createComment);
router.post("/comments/:id/delete", isLoggedIn, postController.deleteComment);
router.get("/comments/:id/edit", isLoggedIn, postController.getEditComment);
router.post("/comments/:id/edit", isLoggedIn, postController.updateComment);
router.get("/posts/create", canCreatePost, postController.getCreatePost);
router.post("/posts", canCreatePost, postController.createPost);
router.post("/posts/:id/delete", isLoggedIn, postController.deletePost);

module.exports = router;
