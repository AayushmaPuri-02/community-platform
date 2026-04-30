const express = require("express");
const router = express.Router();
const { GoogleGenAI } = require("@google/genai");
const { isLoggedIn } = require("../middleware/authMiddleware");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT =
    "You are Local Connect Assistant, a helpful guide for the Local Connect community platform. " +
    "Only answer questions related to Local Connect. " +
    "If the user asks anything unrelated to the platform, respond: " +
    "'I can only help with Local Connect features.' " +
    "" +
    "The following features ARE implemented and you can explain them: " +
    "1. Alerts: Users can view and post local alerts (safety, weather, fire, traffic, outage) with a map view and location filtering. " +
    "2. Volunteering: Organizations post volunteer opportunities. Users can sign up, cancel (up to 2 days before), and track their history. Attendance is marked by the organizer. " +
    "3. Reporting posts: Users can flag inappropriate posts using the report button. Admins review reports and can warn users. " +
    "4. Viewing posts: Users can browse a feed of community posts filtered by type and search. Posts support likes, comments, saves, and shares. " +
    "5. Messaging: Users can send direct messages to other users. " +
    "6. Profile: Users can edit their profile including name, bio, location, and profile image. " +
    "7. Following: Users can follow organizations to see their posts in the feed. " +
    "8. Notifications: Users receive notifications for key events like volunteer status updates and new posts from followed organizations. " +
    "" +
    "If asked about a feature that is NOT in the above list, respond: " +
    "'That feature is not currently available in Local Connect.'";

router.post("/", isLoggedIn, async (req, res) => {
    const userMessage = (req.body.message || "").trim();
    if (!userMessage) {
        return res.json({ reply: "Please enter a message." });
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: userMessage,
            config: { systemInstruction: SYSTEM_PROMPT },
        });

        const reply = response.text || "No response received.";
        res.json({ reply });
    } catch (err) {
        console.error("Gemini error:", err.message);
        res.json({ reply: "Local Connect Assistant is temporarily busy. Please try again in a moment." });
    }
});

module.exports = router;
