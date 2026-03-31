const Post = require("../models/Post");
const Comment = require("../models/Comment");

exports.getCreatePost = (req, res) => {
  res.render("posts/create", { title: "Create Post" });
};

exports.createPost = async (req, res) => {
  const { title, description, type, tags } = req.body;

  try {
    const post = new Post({
      title,
      description,
      type,
      tags: tags ? tags.split(",").map(tag => tag.trim()) : [],
      author: req.session.userId,
    });

    await post.save();

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("Error creating post");
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

    res.render("posts/show", {
      title: post.title,
      post,
      comments, 
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
    const comment = new Comment({
      text,
      post: req.params.id,
      author: req.session.userId,
    });

    await comment.save();

    res.redirect(`/posts/${req.params.id}`);
  } catch (err) {
    console.log(err);
    res.send("Error adding comment");
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

    return res.redirect(`/posts/${comment.post._id || comment.post}`);
  } catch (err) {
    console.log(err);
    return res.send("Error deleting comment");
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

    // only author can update
    if (comment.author.toString() !== req.session.userId) {
      return res.send("Unauthorized");
    }

    comment.text = text;
    await comment.save();

    res.redirect(`/posts/${comment.post}`);
  } catch (err) {
    console.log(err);
    res.send("Error updating comment");
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

    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("Error deleting post");
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

    await post.save();

    res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.log(err);
    res.send("Error updating post");
  }
};