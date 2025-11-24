// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const Feedback = require("./models/Feedback");

const app = express();

// CORS
app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      "null",
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "http://localhost",  
      "https://ishow-feedback-frontend.vercel.app",
      "https://nicowillyx.github.io",
      "https://nicowillyx.github.io/ishow-feedback-frontend/"
    ];

    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));


// JSON body parsing (for non-file submissions)
app.use(express.json());

// Multer memory storage (we'll stream uploads to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Connect to MongoDB
(async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true, useUnifiedTopology: true
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
})();

// Routes
app.get("/", (req, res) => {
  res.json({ ok: true, message: "ISHOW feedback API" });
});

/**
 * POST /api/feedback
 * FormData fields:
 * - name (optional)
 * - item (optional)
 * - rating (required)
 * - message (required)
 * - image (optional file)
 */
app.post("/api/feedback", upload.single("image"), async (req, res) => {
  try {
    const { name, item, rating, message } = req.body;

    // basic validation
    const parsedRating = Number(rating);
    if (!parsedRating || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "rating must be 1-5" });
    }
    if (!message || message.trim().length < 5) {
      return res.status(400).json({ error: "message must be at least 5 characters" });
    }

    let imageUrl = null;

    if (req.file) {

     // upload buffer to Cloudinary
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "ishow_feedback", resource_type: "image" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req.file.buffer);
      imageUrl = result.secure_url;
    }

    const doc = await Feedback.create({
      name: name || null,
      item: item || null,
      rating: parsedRating,
      message: message.trim(),
      image_url: imageUrl
    });

    return res.status(201).json({ ok: true, feedbackId: doc._id });
  } catch (err) {
    console.error("POST /api/feedback error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * (Optional) Admin endpoint to list feedbacks (protect later with a token)
 * GET /api/feedbacks?limit=20
 */
// ADMIN LOGIN CHECK
app.post("/api/admin-login", (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ error: "Missing key" });
  }

  if (key === process.env.ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }

  return res.status(401).json({ error: "Invalid password" });
});

/** */
app.delete("/api/delete/:id", async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});


app.get("/api/feedbacks", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await Feedback.find().sort({ createdAt: -1 }).limit(limit).exec();
    res.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    console.error("GET /api/feedbacks error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
