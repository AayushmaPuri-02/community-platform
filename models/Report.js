const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        reportType: {
            type: String,
            enum: ["post", "account"],
            default: "post",
        },
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            default: null,
        },
        reportedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reason: {
            type: String,
            required: true,
            trim: true,
        },
        note: {
            type: String,
            default: "",
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "reviewed", "dismissed"],
            default: "pending",
        },
        warningSent: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
