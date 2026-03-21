const User = require("../models/User");
const bcrypt = require("bcrypt");

// GET register page
exports.getRegister = (req, res) => {
  res.render("auth/register", { title: "Register" });
};

// POST register
exports.postRegister = async (req, res) => {
  const { fullName, email, password, confirmPassword, location, role } = req.body;

  if (!fullName || !email || !password || !confirmPassword) {
    return res.send("All required fields must be filled");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.send("Enter a valid email address");
  }

  if (password.length < 6) {
    return res.send("Password must be at least 6 characters");
  }

  if (password !== confirmPassword) {
    return res.send("Passwords do not match");
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.send("Email already registered");
    }

const allowedRoles = ["citizen", "organization", "communityAdmin"];

if (!allowedRoles.includes(role)) {
  return res.send("Invalid role selected");
}

const user = new User({
  fullName,
  email,
  password,
  location,
  role,
});

    await user.save();
// Auto-login only citizens
if (user.role === "citizen") {
  req.session.userId = user._id;
  req.session.role = user.role;
  req.session.fullName = user.fullName;
}
    // res.send("User registered successfully");
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("Error registering user");
  }
};

// GET login page
exports.getLogin = (req, res) => {
  res.render("auth/login", { title: "Login" });
};

// POST login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.send("All fields are required");
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.send("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("Invalid email or password");
    }

    // IMPORTANT: approval check
    if (!user.isApproved) {
      return res.send("Your account is pending approval");
    }

    // store session
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.fullName = user.fullName;

    // res.send("Login successful");
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.send("Error logging in");
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Error logging out");
    }

    res.send("Logged out successfully");
  });
};
