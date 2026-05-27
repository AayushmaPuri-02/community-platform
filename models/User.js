const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    organizationName: { type: String, trim: true, required: function () { return this.role === "organization"; } },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, },
    password: { type: String, required: true },
    location: { type: String, trim: true },
    locationName: { type: String, trim: true, default: "" },
    homeLatitude: { type: Number, default: null },
    homeLongitude: { type: Number, default: null },
    bio: { type: String, trim: true, default: "", },
    profileImage: { type: String, default: "", },
    contactInfo: { type: String, trim: true, default: "", },
    publicPhone: { type: String, trim: true, default: "" },
    publicEmail: { type: String, trim: true, default: "" },
    officeHours: { type: String, trim: true, default: "" },
    communityName: { type: String, trim: true },
    mobileNumber: { type: String, trim: true, required: function () { return this.role === "communityAdmin"; } },
    socialMediaLink: { type: String, trim: true },
    verificationDoc: { type: String, required: function () { return this.role === "organization" || this.role === "communityAdmin"; } },
    role: {
      type: String, enum: ["citizen", "organization", "communityAdmin", "systemAdmin"], default: "citizen",
    },
    isApproved: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false, },
    verificationToken: { type: String, default: "", },
    profileCompleted: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", },
    rejectionReason: { type: String, default: "" },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    warningHistory: [{
      reason: { type: String },
      note: { type: String },
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
      warnedAt: { type: Date, default: Date.now },
    }],
    isSuspended: { type: Boolean, default: false },
    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, default: "" },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
    volunteerCount: { type: Number, default: 0 },
    notificationPreferences: {
      emailEnabled: { type: Boolean, default: true },
      messageEmails: { type: Boolean, default: true },
      alertEmails: { type: Boolean, default: true },
      postEmails: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  if (this.role === "citizen") {
    this.status = "approved";
    this.isApproved = true;
  }
});

userSchema.pre("findOneAndDelete", async function (next) {
  const user = await this.model.findOne(this.getFilter());

  if (user) {
    await mongoose.model("Post").deleteMany({ author: user._id });
    await mongoose.model("Comment").deleteMany({ author: user._id });
  }

  next();
});


module.exports = mongoose.model("User", userSchema);