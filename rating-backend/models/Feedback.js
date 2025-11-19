// models/Feedback.js
const mongoose = require("mongoose");

const FeedbackSchema = new mongoose.Schema({
  name: { type: String, default: null },
  item: { type: String, default: null },
  rating: { type: Number, required: true, min: 1, max: 5 },
  message: { type: String, required: true, maxlength: 2000 },
  image_url: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Feedback", FeedbackSchema);
