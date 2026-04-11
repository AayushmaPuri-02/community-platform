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
      enum: ["event", "volunteer", "alert", "training", "communityUpdate"],
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
  },
  
  { timestamps: true }
);

const Post = mongoose.model("Post", postSchema);

module.exports = Post;