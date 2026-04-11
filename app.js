const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const session = require("express-session");
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");
const {isLoggedIn, isOrganization} = require("./middleware/authMiddleware")
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const Post = require("./models/Post");
const Comment = require("./models/Comment");
const adminRoutes = require("./routes/adminRoutes");
const profileRoutes = require("./routes/profileRoutes");
const User = require("./models/User");
const userRoutes = require("./routes/userRoutes");
const followRoutes = require("./routes/followRoutes");
const followingRoutes = require("./routes/followingRoutes");
const Follow = require("./models/Follow");
const flash = require("connect-flash");
const { ensureProfileComplete } = require("./middleware/authMiddleware");
const messageRoutes = require("./routes/messageRoutes");
const Message = require("./models/Message");


const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);


app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  res.locals.role = req.session.role || null;
  res.locals.fullName = req.session.fullName || null;
  res.locals.organizationName = req.session.organizationName || null;
  res.locals.currentPath = req.path;
  next();
});

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.info = req.flash("info");
  next();
});

//messaging
app.use(async (req, res, next) => {
  try {
    if (req.session.userId) {
      const unreadMessages = await Message.find({
        receiver: req.session.userId,
        isRead: false
      }).select("sender");

      const uniqueSenders = new Set(
        unreadMessages.map(msg => msg.sender.toString())
      );

      res.locals.unreadCount = uniqueSenders.size;
    } else {
      res.locals.unreadCount = 0;
    }

    next();
  } catch (err) {
    console.log(err);
    res.locals.unreadCount = 0;
    next();
  }
});
// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");

// Routes

app.get("/", (req, res) => {
  if (req.session.userId) {
    if (req.session.role === "systemAdmin") {
      return res.redirect("/admin");
    }

    if (
      (req.session.role === "organization" || req.session.role === "communityAdmin") &&
      !req.session.profileCompleted
    ) {
      return res.redirect("/profile/edit");
    }

    return res.redirect("/home");
  }

  return res.render("landing", {
    title: "Local Connect",
    hideSidebar: true,
  });
});


app.get("/home", ensureProfileComplete, async (req, res) => {
  try {
    let followedUserIds = [];

    if (req.session.userId) {
      const follows = await Follow.find({
        follower: req.session.userId,
      });

      followedUserIds = follows.map(f => f.following);
    }

    // 1. posts from followed users
    const followedPosts = await Post.find({
      author: { $in: followedUserIds },
    })
      .populate("author")
      .sort({ createdAt: -1 });

    // 2. other posts
    const otherPosts = await Post.find({
      author: { $nin: followedUserIds },
    })
      .populate("author")
      .sort({ createdAt: -1 });

    // combine
    const posts = [...followedPosts, ...otherPosts];

    // attach comment count
    for (let post of posts) {
      const count = await Comment.countDocuments({ post: post._id });
      post.commentCount = count;
    }

    const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;
    res.render("auth/index", {
      title: "Home",
      posts,
      userSavedPosts: currentUser ? currentUser.savedPosts : []
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading homepage");
  }
});
app.use("/", authRoutes);
app.use("/", postRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", profileRoutes);
app.use("/users", ensureProfileComplete,userRoutes);
app.use("/follow", followRoutes);
app.use("/following",ensureProfileComplete, followingRoutes);
app.use("/messages", messageRoutes);


//explore page
app.get("/explore", ensureProfileComplete, async (req, res) => {
  try {
    const currentUserId = req.session.userId;

    const profiles = await User.find({
      status: "approved",
      role: { $in: ["organization", "communityAdmin"] },
      _id: { $ne: currentUserId }
    }).sort({ createdAt: -1 });

    const followedRecords = currentUserId
      ? await Follow.find({ follower: currentUserId }).select("following")
      : [];

    const followedIds = new Set(followedRecords.map(f => f.following.toString()));

    const profileIds = profiles.map(profile => profile._id);

    const followerCounts = await Follow.aggregate([
      { $match: { following: { $in: profileIds } } },
      { $group: { _id: "$following", count: { $sum: 1 } } }
    ]);

    const followerCountMap = {};
    followerCounts.forEach(item => {
      followerCountMap[item._id.toString()] = item.count;
    });

    const profilesWithMeta = profiles.map(profile => ({
      ...profile.toObject(),
      isFollowing: followedIds.has(profile._id.toString()),
      followerCount: followerCountMap[profile._id.toString()] || 0
    }));

    res.render("explore/index", {
      title: "Explore Communities & Organizations",
      profiles: profilesWithMeta,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading explore page");
  }
});

//saved page
app.get("/saved", isLoggedIn, ensureProfileComplete, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).populate({
      path: "savedPosts",
      populate: { path: "author" }
    });

    res.render("saved/index", {
      title: "Saved Posts",
      savedPosts: user ? user.savedPosts : []
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading saved posts");
  }
});

app.get("/dashboard", isLoggedIn, (req, res) => {
  res.send("Welcome to dashboard");
});

app.get("/org-dashboard", isLoggedIn, isOrganization, (req, res) => {
  res.send("Organization dashboard");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});