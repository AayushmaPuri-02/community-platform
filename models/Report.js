const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
    {
        post: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Post",
            required: true,
        },
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        reason: {
            type: String,
            enum: ["spam", "misinformation", "harassment", "hate_speech", "scam_fraud", "inappropriate"],
            required: true,
        },
        note: {
            type: String,
            default: "",
            trim: true,
        },
        warningSent: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
