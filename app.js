const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const session = require("express-session");
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");
const { isLoggedIn, isOrganization } = require("./middleware/authMiddleware")
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
const settingsRoutes = require("./routes/settingsRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const Notification = require("./models/Notification");
const { getVolunteerBadge } = require("./utils/volunteerBadge");
const { getDashboardAnalytics } = require("./utils/dashboardAnalytics");
const { formatAlertDate } = require("./utils/formatAlertDate");
const { getReasonLabel, ACCOUNT_REASONS } = require("./utils/reportReasons");


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
  res.locals.getVolunteerBadge = getVolunteerBadge;
  res.locals.formatAlertDate = formatAlertDate;
  res.locals.getReasonLabel = getReasonLabel;
  res.locals.ACCOUNT_REASONS = ACCOUNT_REASONS;
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

// notifications
app.use(async (req, res, next) => {
  try {
    if (req.session.userId) {
      res.locals.notifUnreadCount = await Notification.countDocuments({
        recipient: req.session.userId,
        isRead: false,
      });

      res.locals.notifications = await Notification.find({
        recipient: req.session.userId,
      })
        .sort({ createdAt: -1 })
        .limit(10);
    } else {
      res.locals.notifUnreadCount = 0;
      res.locals.notifications = [];
    }
    next();
  } catch (err) {
    console.log(err);
    res.locals.notifUnreadCount = 0;
    res.locals.notifications = [];
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

// ── Public info pages ─────────────────────────────────────────────────────────
const infoOpts = { hideSidebar: true, layout: "layouts/info" };

app.get("/about", (req, res) => res.render("info/about", { title: "About — Local Connect", ...infoOpts }));
app.get("/how-it-works", (req, res) => res.render("info/how-it-works", { title: "How It Works — Local Connect", ...infoOpts }));
app.get("/community-guidelines", (req, res) => res.render("info/guidelines", { title: "Community Guidelines — Local Connect", ...infoOpts }));
app.get("/help", (req, res) => res.render("info/help", { title: "Help & Support — Local Connect", ...infoOpts }));


app.get("/home", isLoggedIn, ensureProfileComplete, async (req, res) => {
  try {
    const selectedType = req.query.type || "";
    const searchQuery = req.query.search || "";

    const filter = {};
    if (selectedType) filter.type = selectedType;
    if (searchQuery) {
      const regex = new RegExp(searchQuery, "i");
      filter.$or = [{ title: regex }, { tags: regex }];
    }

    // Single mixed feed — all posts, shuffled
    const posts = await Post.find(filter)
      .populate("author")
      .sort({ createdAt: -1 });

    // Fisher-Yates shuffle for random feed order
    for (let i = posts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [posts[i], posts[j]] = [posts[j], posts[i]];
    }

    for (let post of posts) {
      post.commentCount = await Comment.countDocuments({ post: post._id });
    }

    // Recent posts sidebar — last 7 days only, newest first, no shuffle
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentPosts = await Post.find({ createdAt: { $gte: sevenDaysAgo } })
      .populate("author", "fullName organizationName communityName")
      .sort({ createdAt: -1 })
      .limit(8);

    const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;

    res.render("auth/index", {
      title: "Home",
      posts,
      recentPosts,
      userSavedPosts: currentUser ? currentUser.savedPosts : [],
      selectedType,
      searchQuery,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading homepage");
  }
});
const chatbotRoutes = require("./routes/chatbotRoutes");
app.use("/api/chatbot", chatbotRoutes);
app.use("/", authRoutes);
app.use("/", postRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", profileRoutes);
app.use("/users", ensureProfileComplete, userRoutes);
app.use("/follow", followRoutes);
app.use("/following", ensureProfileComplete, followingRoutes);
app.use("/messages", messageRoutes);
app.use("/settings", settingsRoutes);
app.use("/", reportRoutes);
app.use("/", notificationRoutes);


//explore page
app.get("/explore", isLoggedIn, ensureProfileComplete, async (req, res) => {
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

// alerts page
app.get("/alerts", isLoggedIn, ensureProfileComplete, async (req, res) => {
  try {
    const alertPosts = await Post.find({ type: "alert" })
      .populate("author")
      .sort({ createdAt: -1 });

    for (let post of alertPosts) {
      const count = await Comment.countDocuments({ post: post._id });
      post.commentCount = count;
    }

    const currentUser = req.session.userId ? await User.findById(req.session.userId) : null;

    res.render("alerts/index", {
      title: "Alerts",
      posts: alertPosts,
      userSavedPosts: currentUser ? currentUser.savedPosts : [],
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
      homeLatitude: currentUser ? (currentUser.homeLatitude || null) : null,
      homeLongitude: currentUser ? (currentUser.homeLongitude || null) : null,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading alerts");
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

// GET /share/recipients — returns messageable users for the share-via-message modal
app.get("/share/recipients", isLoggedIn, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.session.userId },
      role: { $ne: "systemAdmin" },
      status: "approved",
      isVerified: true,
    })
      .select("_id fullName organizationName communityName role")
      .sort({ fullName: 1, organizationName: 1 })
      .limit(100);

    const list = users.map(u => ({
      _id: u._id,
      name: u.communityName || u.organizationName || u.fullName || "Unknown",
      role: u.role,
    }));

    return res.json(list);
  } catch (err) {
    console.log(err);
    return res.status(500).json([]);
  }
});

app.get("/community-dashboard", isLoggedIn, async (req, res) => {
  if (req.session.role !== "communityAdmin") {
    req.flash("error", "Access denied");
    return res.redirect("/home");
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    const totalPosts = await Post.countDocuments({ author: user._id });
    const alertPosts = await Post.countDocuments({ author: user._id, type: "alert" });
    const recentPosts = await Post.find({ author: user._id }).sort({ createdAt: -1 }).limit(5);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const postsThisWeek = await Post.countDocuments({
      author: user._id,
      createdAt: { $gte: oneWeekAgo }
    });

    const followerCount = await Follow.countDocuments({ following: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    const { postTypeCounts, postTypeChart, topPerformingPost } =
      await getDashboardAnalytics(user._id);

    // 7-day grace period: show volunteer posts up to 7 days after their event date
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const volunteerPosts = await Post.find({
      author: user._id,
      type: "volunteer",
      volunteerDate: { $gte: sevenDaysAgo }
    })
      .populate({ path: "volunteers.user", select: "fullName volunteerCount role" })
      .sort({ volunteerDate: 1 });

    const activeVolunteerPosts = volunteerPosts.filter(p => !p.volunteerDate || new Date(p.volunteerDate) >= now);
    const pastVolunteerPosts = volunteerPosts.filter(p => p.volunteerDate && new Date(p.volunteerDate) < now);

    res.render("community/dashboard", {
      title: "Dashboard",
      user,
      totalPosts,
      alertPosts,
      recentPosts,
      postsThisWeek,
      followerCount,
      followingCount,
      postTypeCounts,
      postTypeChart,
      topPerformingPost,
      volunteerPosts,
      activeVolunteerPosts,
      pastVolunteerPosts,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading dashboard");
  }
});

app.get("/org-dashboard", isLoggedIn, async (req, res) => {
  if (req.session.role !== "organization") {
    req.flash("error", "Access denied");
    return res.redirect("/home");
  }

  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect("/login");

    const totalPosts = await Post.countDocuments({ author: user._id });
    const alertPosts = await Post.countDocuments({ author: user._id, type: "alert" });
    const recentPosts = await Post.find({ author: user._id }).sort({ createdAt: -1 }).limit(5);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const postsThisWeek = await Post.countDocuments({
      author: user._id,
      createdAt: { $gte: oneWeekAgo }
    });

    const followerCount = await Follow.countDocuments({ following: user._id });
    const followingCount = await Follow.countDocuments({ follower: user._id });

    const { postTypeCounts, postTypeChart, topPerformingPost } =
      await getDashboardAnalytics(user._id);

    // 7-day grace period: show volunteer posts up to 7 days after their event date
    const now2 = new Date();
    const sevenDaysAgo2 = new Date(now2);
    sevenDaysAgo2.setDate(sevenDaysAgo2.getDate() - 7);

    const volunteerPosts = await Post.find({
      author: user._id,
      type: "volunteer",
      volunteerDate: { $gte: sevenDaysAgo2 }
    })
      .populate({ path: "volunteers.user", select: "fullName volunteerCount role" })
      .sort({ volunteerDate: 1 });

    const activeVolunteerPosts = volunteerPosts.filter(p => !p.volunteerDate || new Date(p.volunteerDate) >= now2);
    const pastVolunteerPosts = volunteerPosts.filter(p => p.volunteerDate && new Date(p.volunteerDate) < now2);

    res.render("community/dashboard", {
      title: "Dashboard",
      user,
      totalPosts,
      alertPosts,
      recentPosts,
      postsThisWeek,
      followerCount,
      followingCount,
      postTypeCounts,
      postTypeChart,
      topPerformingPost,
      volunteerPosts,
      activeVolunteerPosts,
      pastVolunteerPosts,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading dashboard");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});