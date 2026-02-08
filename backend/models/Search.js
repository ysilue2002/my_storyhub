// models/Search.js
const mongoose = require('mongoose');

const searchSchema = new mongoose.Schema({
  query: String,
  platform: String,
  results: [Object],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Search', searchSchema);