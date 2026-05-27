const crypto = require("crypto");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Follow = require("../models/Follow");
const { sendEmail } = require("../utils/mailer");
const { createNotification } = require("../utils/notifications");
const { marked } = require("marked");
const { generateEmailTemplate } = require("../utils/emailTemplate");
const { formatAlertDate } = require("../utils/formatAlertDate");

function authorDisplayName(author) {
  if (!author) return "Unknown";
  return author.communityName || author.organizationName || author.fullName || "Unknown";
}

function wantsJsonResponse(req) {
  return (
    req.xhr ||
    req.get("Accept")?.includes("application/json") ||
    req.headers["x-requested-with"] === "XMLHttpRequest"
  );
}

function serializeCommentForApi(comment) {
  return {
    _id: comment._id,
    text: comment.text,
    createdAt: comment.createdAt,
    formattedDate: formatAlertDate(comment.createdAt),
    isPinned: !!comment.isPinned,
    author: {
      _id: comment.author._id,
      name: authorDisplayName(comment.author),
      profileImage: comment.author.profileImage || "/images/default-avatar.png",
    },
  };
}

// Configure marked: no HTML passthrough, safe defaults
marked.setOptions({ breaks: true, gfm: true });

// Haversine distance in km
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.getCreatePost = (req, res) => {
  const formData = req.session.postFormData || {};
  delete req.session.postFormData;
  res.render("posts/create", {
    title: "Create Post",
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    userRole: req.session.role || "",
    formData,
    fieldErrors: {},
  });
};

exports.createPost = async (req, res) => {
  // Save form data for repopulation on validation errors
  req.session.postFormData = {
    title: req.body.title || "",
    description: req.body.description || "",
    type: req.body.type || "",
    tags: req.body.tags || "",
    alertCategory: req.body.alertCategory || "",
    alertRadius: req.body.alertRadius || "",
    locationName: req.body.locationName || "",
    latitude: req.body.latitude || "",
    longitude: req.body.longitude || "",
    volunteerDate: req.body.volunteerDate || "",
    maxVolunteers: req.body.maxVolunteers || "",
  };

  try {
    const { title, description, type, tags, volunteerDate, maxVolunteers } = req.body;

    // Role-based type validation
    const allowedTypes = {
      organization: ["event", "volunteer", "notice", "training"],
      communityAdmin: ["alert", "notice", "event", "volunteer", "communityUpdate"],
    };
    const userRole = req.session.role;
    if (allowedTypes[userRole] && !allowedTypes[userRole].includes(type)) {
      req.flash("error", "You are not allowed to create this type of post.");
      return res.redirect("/posts/create");
    }

    const titleWords = title ? title.trim().split(/\s+/).filter(Boolean).length : 0;
    const descWords = description ? description.trim().split(/\s+/).filter(Boolean).length : 0;

    if (titleWords > 20) {
      req.flash("error", "Post title must not exceed 20 words");
      return res.redirect("/posts/create");
    }

    if (descWords > 300) {
      req.flash("error", "Post description must not exceed 300 words");
      return res.redirect("/posts/create");
    }

    const post = new Post({
      title,
      description,
      type,
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      author: req.session.userId,
    });

    if (type === "volunteer") {
      if (volunteerDate) post.volunteerDate = new Date(volunteerDate);
      if (maxVolunteers) post.maxVolunteers = parseInt(maxVolunteers) || 0;
    }

    if (type === "alert") {
      const lat = parseFloat(req.body.latitude);
      const lng = parseFloat(req.body.longitude);
      const formData = req.session.postFormData || {};

      const renderWithError = (fieldErrors) => {
        return res.render("posts/create", {
          title: "Create Post",
          googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
          userRole: req.session.role || "",
          formData,
          fieldErrors,
        });
      };

      if (!req.body.latitude || !req.body.longitude || isNaN(lat) || isNaN(lng)) {
        return renderWithError({ location: "Please search and pin a location on the map before submitting." });
      }
      if (!req.body.alertRadius) {
        return renderWithError({ radius: "Affected radius is required for alerts." });
      }

      // communityAdmin: restrict alert to within 3 km of assigned area
      if (userRole === "communityAdmin") {
        const author = await User.findById(req.session.userId).select("homeLatitude homeLongitude");
        if (!author || !author.homeLatitude || !author.homeLongitude) {
          return renderWithError({ location: "Your community location is not set. Please update your profile location." });
        }
        const dist = getDistanceKm(author.homeLatitude, author.homeLongitude, lat, lng);
        if (dist > 3) {
          return renderWithError({ location: "Alert location must be within 3km of your assigned community area." });
        }
      }

      post.locationName = req.body.locationName ? req.body.locationName.trim() : "";
      post.latitude = lat;
      post.longitude = lng;
      post.alertCategory = req.body.alertCategory || "";
      post.alertRadius = req.body.alertRadius || "";
    }

    if (req.files && req.files.length > 0) {
      post.images = req.files.map(file => ({
        url: file.path,
        filename: file.filename,
      }));
    }

    await post.save();

    // Notify + email followers — does not block post creation
    try {
      const follows = await Follow.find({ following: post.author }).populate("follower");
      const authorUser = await User.findById(post.author).select("fullName organizationName communityName");
      const authorName = authorUser
        ? (authorUser.communityName || authorUser.organizationName || authorUser.fullName)
        : "Someone you follow";

      for (const follow of follows) {
        const follower = follow.follower;
        if (!follower) continue;

        // In-app notification for every follower
        await createNotification(
          follower._id,
          `${authorName} published a new post: "${post.title}"`,
          `/posts/${post._id}`
        );

        const prefs = follower.notificationPreferences;
        if (!prefs || !prefs.emailEnabled) continue;

        if (post.type === "alert" && prefs.alertEmails) {
          try {
            sendEmail({
              to: follower.email,
              subject: "New Alert in Your Community — Local Connect",
              html: generateEmailTemplate({
                heading: "New Alert Posted",
                name: follower.organizationName || follower.fullName || "there",
                body: `${authorName} has posted a new alert in your community.\nLog in to Local Connect to view the details and stay informed.`,
                highlight: `<strong>${post.title}</strong>`,
                highlightLabel: "Alert",
              }),
            });
          } catch (e) { console.log("Alert email error:", e.message); }
          continue;
        }

        if (prefs.postEmails) {
          try {
            sendEmail({
              to: follower.email,
              subject: "New Post from a Page You Follow — Local Connect",
              html: generateEmailTemplate({
                heading: "New Post from a Page You Follow",
                name: follower.organizationName || follower.fullName || "there",
                body: `${authorName} has published a new post on Local Connect.\nLog in to read it and stay up to date with your community.`,
                highlight: `<strong>${post.title}</strong>`,
                highlightLabel: "Post",
              }),
            });
          } catch (e) { console.log("Post email error:", e.message); }
        }
      }
    } catch (notifErr) {
      console.log("Follower notification error:", notifErr.message);
    }

    delete req.session.postFormData;
    req.flash("success", "Post created successfully");
    return res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error creating post");
    return res.redirect("/posts/create");
  }
};

exports.getPostApi = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate(
      "author",
      "fullName organizationName communityName profileImage"
    );

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comments = await Comment.find({ post: req.params.id, parentComment: null })
      .populate("author", "fullName organizationName communityName profileImage")
      .sort({ isPinned: -1, createdAt: -1 });

    const images = [];
    if (post.images && post.images.length > 0) {
      post.images.forEach((img) => {
        if (img.url) images.push({ url: img.url });
      });
    } else if (post.postImage && post.postImage.url) {
      images.push({ url: post.postImage.url });
    }

    return res.json({
      post: {
        _id: post._id,
        title: post.title,
        descriptionHtml: marked.parse(post.description || ""),
        type: post.type,
        alertCategory: post.alertCategory || "",
        alertStatus: post.alertStatus || "Active",
        locationName: post.locationName || "",
        alertRadius: post.alertRadius || "",
        createdAt: post.createdAt,
        formattedDate: formatAlertDate(post.createdAt),
        images,
        author: {
          _id: post.author._id,
          name: authorDisplayName(post.author),
          profileImage: post.author.profileImage || "/images/default-avatar.png",
        },
      },
      comments: comments.map(serializeCommentForApi),
    });
  } catch (err) {
    console.error("getPostApi error:", err);
    return res.status(500).json({ error: "Failed to load post" });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("author");

    if (!post) {
      return res.send("Post not found");
    }

    // Fetch only top-level comments (no parent), pinned first then newest
    const comments = await Comment.find({ post: req.params.id, parentComment: null })
      .populate("author")
      .sort({ isPinned: -1, createdAt: -1 });

    // Fetch all replies for this post in one query, group by parentComment
    const allReplies = await Comment.find({
      post: req.params.id,
      parentComment: { $ne: null }
    })
      .populate("author")
      .sort({ createdAt: 1 });

    // Build a map: parentCommentId (string) -> array of replies
    const repliesByComment = {};
    allReplies.forEach(reply => {
      const key = reply.parentComment.toString();
      if (!repliesByComment[key]) repliesByComment[key] = [];
      repliesByComment[key].push(reply);
    });

    let backUrl = "/";
    if (req.query.from === "profile" && req.query.userId) {
      backUrl = `/users/${req.query.userId}`;
    }

    const currentUser = await User.findById(req.session.userId);
    const renderedDescription = marked.parse(post.description || "");
    res.render("posts/show", {
      title: post.title,
      post,
      renderedDescription,
      comments,
      repliesByComment,
      userSavedPosts: currentUser ? currentUser.savedPosts : [],
      backUrl,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading post");
  }
};

exports.createComment = async (req, res) => {
  const { text } = req.body;
  const json = wantsJsonResponse(req);

  try {
    const trimmedText = text ? text.trim() : "";

    if (!trimmedText) {
      if (json) {
        return res.status(400).json({ success: false, message: "Comment cannot be empty" });
      }
      req.flash("error", "Comment cannot be empty");
      return res.redirect(`/posts/${req.params.id}#comments`);
    }

    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

    if (wordCount > 100) {
      if (json) {
        return res.status(400).json({ success: false, message: "Comment must not exceed 100 words" });
      }
      req.flash("error", "Comment must not exceed 100 words");
      return res.redirect(`/posts/${req.params.id}#comments`);
    }

    const comment = new Comment({
      text: trimmedText,
      post: req.params.id,
      author: req.session.userId,
    });

    await comment.save();

    if (json) {
      const populated = await Comment.findById(comment._id).populate(
        "author",
        "fullName organizationName communityName profileImage"
      );
      return res.json({ success: true, comment: serializeCommentForApi(populated) });
    }

    req.flash("success", "Comment added successfully");
    return res.redirect(`/posts/${req.params.id}#comments`);
  } catch (err) {
    console.log(err);
    if (json) {
      return res.status(500).json({ success: false, message: "Error adding comment" });
    }
    req.flash("error", "Error adding comment");
    return res.redirect(`/posts/${req.params.id}#comments`);
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

    // If this is a top-level comment, delete all its replies too
    if (!comment.parentComment) {
      await Comment.deleteMany({ parentComment: comment._id });
    }

    await Comment.findByIdAndDelete(req.params.id);

    req.flash("success", "Comment deleted successfully");
    return res.redirect(`/posts/${comment.post._id || comment.post}#comments`);
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
      return res.redirect(`/posts/${comment.post}#comments`);
    }

    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;

    if (wordCount > 100) {
      req.flash("error", "Comment must not exceed 100 words");
      return res.redirect(`/posts/${comment.post}#comments`);
    }

    comment.text = trimmedText;
    await comment.save();

    req.flash("success", "Comment updated successfully");
    return res.redirect(`/posts/${comment.post}#comments`);
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
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading edit post page");
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { title, description, type, tags, volunteerDate, maxVolunteers } = req.body;

    const titleWords = title ? title.trim().split(/\s+/).filter(Boolean).length : 0;
    const descWords = description ? description.trim().split(/\s+/).filter(Boolean).length : 0;

    if (titleWords > 20) {
      req.flash("error", "Post title must not exceed 20 words");
      return res.redirect(`/posts/${req.params.id}/edit`);
    }

    if (descWords > 300) {
      req.flash("error", "Post description must not exceed 300 words");
      return res.redirect(`/posts/${req.params.id}/edit`);
    }

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

    if (type === "volunteer") {
      if (volunteerDate) post.volunteerDate = new Date(volunteerDate);
      if (maxVolunteers) post.maxVolunteers = parseInt(maxVolunteers) || 0;
    }

    if (type === "alert") {
      const editLat = req.body.latitude ? parseFloat(req.body.latitude) || null : null;
      const editLng = req.body.longitude ? parseFloat(req.body.longitude) || null : null;

      if (!req.body.alertRadius) {
        req.flash("error", "Affected radius is required for alerts.");
        return res.redirect(`/posts/${req.params.id}/edit`);
      }

      // communityAdmin: restrict alert to within 3 km of assigned area
      if (req.session.role === "communityAdmin" && editLat && editLng) {
        const editor = await User.findById(req.session.userId).select("homeLatitude homeLongitude");
        if (!editor || !editor.homeLatitude || !editor.homeLongitude) {
          req.flash("error", "Your community location is not set. Please update your profile location.");
          return res.redirect(`/posts/${req.params.id}/edit`);
        }
        const dist = getDistanceKm(editor.homeLatitude, editor.homeLongitude, editLat, editLng);
        if (dist > 3) {
          req.flash("error", "Alert location must be within 3km of your assigned community area.");
          return res.redirect(`/posts/${req.params.id}/edit`);
        }
      }

      post.locationName = req.body.locationName ? req.body.locationName.trim() : "";
      post.latitude = editLat;
      post.longitude = editLng;
      post.alertCategory = req.body.alertCategory || "";
      post.alertRadius = req.body.alertRadius || "";
      post.alertStatus = req.body.alertStatus === "Resolved" ? "Resolved" : "Active";
    }

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

exports.createReply = async (req, res) => {
  const { text } = req.body;
  const { postId, commentId } = req.params;

  try {
    const trimmedText = text ? text.trim() : "";

    if (!trimmedText) {
      req.flash("error", "Reply cannot be empty");
      return res.redirect(`/posts/${postId}#comments`);
    }

    const wordCount = trimmedText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 100) {
      req.flash("error", "Reply must not exceed 100 words");
      return res.redirect(`/posts/${postId}#comments`);
    }

    // Verify the parent comment exists and belongs to this post
    const parentComment = await Comment.findOne({ _id: commentId, post: postId });
    if (!parentComment) {
      req.flash("error", "Comment not found");
      return res.redirect(`/posts/${postId}#comments`);
    }

    // Replies are always attached to a top-level comment —
    // if the parent is itself a reply, attach to its parent instead (keeps nesting flat)
    const attachTo = parentComment.parentComment
      ? parentComment.parentComment
      : parentComment._id;

    const reply = new Comment({
      text: trimmedText,
      post: postId,
      author: req.session.userId,
      parentComment: attachTo,
    });

    await reply.save();
    req.flash("success", "Reply added");
    return res.redirect(`/posts/${postId}#comments`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error adding reply");
    return res.redirect(`/posts/${postId}#comments`);
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      req.flash("error", "Post not found");
      return res.redirect("/home");
    }

    if (post.type !== "alert") {
      req.flash("error", "Only alert posts can be resolved");
      return res.redirect(`/posts/${post._id}`);
    }

    if (post.author.toString() !== req.session.userId.toString()) {
      req.flash("error", "Only the post author can resolve this alert");
      return res.redirect(`/posts/${post._id}`);
    }

    post.alertStatus = "Resolved";
    post.resolvedAt = new Date();
    await post.save();

    req.flash("success", "Alert marked as resolved.");
    return res.redirect(`/posts/${post._id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Error resolving alert");
    return res.redirect("/home");
  }
};
