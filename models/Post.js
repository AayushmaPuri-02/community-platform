const mongoose = require("mongoose");
const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },
    images: [
      {
        url: String,
        filename: String,
      }
    ],
    type: {
      type: String,
      enum: ["event", "volunteer", "alert", "notice", "training", "communityUpdate"],
      required: true,
    },

    tags: [
      {
        type: String,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }
    ],

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Volunteer-specific fields
    volunteerDate: { type: Date },
    maxVolunteers: { type: Number, default: 0 },
    volunteers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        fullName: { type: String, trim: true },
        phone: { type: String, trim: true },
        note: { type: String, trim: true, default: "" },
        joinedAt: { type: Date, default: Date.now },
        attended: { type: Boolean, default: false },
        status: { type: String, enum: ["pending", "rejected", "attended"], default: "pending" },
        rejectionReason: { type: String, default: "" },
        contributionNote: { type: String, trim: true, default: "" },
      }
    ],

    // Alert-specific location fields
    locationName: { type: String, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    alertCategory: { type: String, enum: ["", "Safety", "Outage", "Weather", "Fire", "Traffic"], default: "" },
    alertRadius: { type: String, enum: ["", "500m", "1km", "2km", "5km"], default: "" },
    alertStatus: { type: String, enum: ["Active", "Resolved"], default: "Active" },
    resolvedAt: { type: Date, default: null },
  },

  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

module.exports = Post;