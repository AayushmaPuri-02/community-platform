const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const session = require("express-session");
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");
const {isLoggedIn, isOrganization} = require("./middleware/authMiddleware")
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const Post = require("./models/Post");
const Comment = require("./models/Comment");


dotenv.config();

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

app.use((req, res, next) => {
  res.locals.userId = req.session.userId || null;
  res.locals.role = req.session.role || null;
  res.locals.fullName = req.session.fullName || null;
  next();
});

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/main");

// Routes
app.get("/", async (req, res) => {
  try {
    const posts = await Post.find({})
      .populate("author")
      .sort({ createdAt: -1 });

    // attach comment count to each post
    for (let post of posts) {
      const count = await Comment.countDocuments({ post: post._id });
      post.commentCount = count;
    }

    res.render("auth/index", {
      title: "Home",
      posts,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading homepage");
  }
});

app.use("/", authRoutes);
app.use("/", postRoutes);

app.get("/dashboard", isLoggedIn, (req, res) => {
  res.send("Welcome to dashboard");
});

app.get("/org-dashboard", isLoggedIn, isOrganization, (req, res) => {
  res.send("Organization dashboard");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});