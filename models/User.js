const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
    },

    location: {
      type: String,
      // optional for now
    },

    role: {
      type: String,
      enum: ["citizen", "organization", "communityAdmin", "systemAdmin"],
      default: "citizen",
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    verificationDoc: {
      type: String,
      // we will handle this later when we build org/admin registration
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  if (this.role === "citizen") {
    this.isApproved = true;
  }
});

module.exports = mongoose.model("User", userSchema);