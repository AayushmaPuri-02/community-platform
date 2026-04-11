const crypto = require("crypto");
const User = require("../models/User");const Post = require("../models/Post");
const Comment = require("../models/Comment");

exports.getCreatePost = (req, res) => {
  res.render("posts/create", { title: "Create Post" });
};

exports.createPost = async (req, res) => {
  try {
    const { title, description, type, tags } = req.body;

    const post = new Post({
      title,
      description,
      type,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      author: req.session.userId,
    });

    // 🔥 ADD THIS BLOCK
if (req.files && req.files.length > 0) {
  post.images = req.files.map(file => ({
    url: file.path,
    filename: file.filename,
  }));
}

    await post.save();
    req.flash("success", "Post created successfully");
    return res.redirect(`/posts/${post._id}`);
 } catch (err) {
  console.log(err);
  req.flash("error", "Error creating post");
  return res.redirect("/posts/create");
}
};

exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("author");

    const comments = await Comment.find({ post: req.params.id })   //this section is updated
      .populate("author")
      .sort({isPinned: -1, createdAt: -1 });

 let backUrl = "/";
    if (req.query.from === "profile" && req.query.userId) {
      backUrl = `/users/${req.query.userId}`;
    }

    if (!post) {
      return res.send("Post not found");
    }

    const currentUser = await User.findById(req.session.userId);
    res.render("posts/show", {
      title: post.title,
      post,
      comments, 
      userSavedPosts: currentUser ? currentUser.savedPosts : [],
      backUrl,  //this is added after the comment model is added
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading post");
  }
};

exports.createComment = async (req, res) => {
  const { text } = req.body;

  try {
    const trimmedText = text ? text.trim() : "";

    if (!trimmedText) {
      req.flash("error", "Comment cannot be empty");
      return res.redirect(`/posts/${req.params.id}`);
    }

    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

    if (wordCount > 100) {
      req.flash("error", "Comment must not exceed 100 words");
      return res.redirect(`/posts/${req.params.id}`);
    }

    const comment = new Comment({
      text: trimmedText,
      post: req.params.id,
      author: req.session.userId,
    });

    await comment.save();
    req.flash("success", "Comment added successfully");
    return res.redirect(`/posts/${req.params.id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error adding comment");
    return res.redirect(`/posts/${req.params.id}`);
  }
};


exports.deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id).populate("post");

    if (!comment) {
      return res.send("Comment not found");
    }

    // comment author OR post author can delete
    if (
      comment.author.toString() !== req.session.userId &&
      comment.post.author.toString() !== req.session.userId
    ) {
      return res.send("Not authorized");
    }

    await Comment.findByIdAndDelete(req.params.id);

    req.flash("success", "Comment deleted successfully");
    return res.redirect(`/posts/${comment.post._id || comment.post}`);
  } catch (err) {
  console.log(err);
  req.flash("error", "Error deleting comment");
  return res.redirect("/home");
}
};
exports.getEditComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.send("Comment not found");
    }

    // only author can edit
    if (comment.author.toString() !== req.session.userId) {
      return res.send("Unauthorized");
    }

    res.render("comments/edit", {
      title: "Edit Comment",
      comment,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading edit page");
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { text } = req.body;

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.send("Comment not found");
    }

    if (comment.author.toString() !== req.session.userId) {
      return res.send("Unauthorized");
    }

    const trimmedText = text ? text.trim() : "";

    if (!trimmedText) {
      req.flash("error", "Comment cannot be empty");
      return res.redirect(`/posts/${comment.post}`);
    }

    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

    if (wordCount > 100) {
      req.flash("error", "Comment must not exceed 100 words");
      return res.redirect(`/posts/${comment.post}`);
    }

    comment.text = trimmedText;
    await comment.save();

    req.flash("success", "Comment updated successfully");
    return res.redirect(`/posts/${comment.post}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error updating comment");
    return res.redirect("/home");
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.send("Post not found");
    }

    // only author can delete
    if (post.author.toString() !== req.session.userId) {
      return res.send("Unauthorized");
    }

    await Post.findByIdAndDelete(req.params.id);
   req.flash("success", "Post deleted successfully");
return res.redirect("/home");
} catch (err) {
  console.log(err);
  req.flash("error", "Error deleting post");
  return res.redirect("/");
}
};

exports.getEditPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.send("Post not found");
    }

    if (post.author.toString() !== req.session.userId) {
      return res.send("Unauthorized");
    }

    res.render("posts/edit", {
      title: "Edit Post",
      post,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading edit post page");
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { title, description, type, tags } = req.body;

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.send("Post not found");
    }

    if (post.author.toString() !== req.session.userId) {
      return res.send("Unauthorized");
    }

    post.title = title;
    post.description = description;
    post.type = type;
    post.tags = tags ? tags.split(",").map(tag => tag.trim()) : [];

    if (req.files && req.files.length > 0) {
      post.images = req.files.map(file => ({
        url: file.path,
        filename: file.filename,
      }));
    }

    await post.save();

    req.flash("success", "Post updated successfully");
    return res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error updating post");
    return res.redirect("/");
  }
};