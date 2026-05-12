const mongoose = require('mongoose');

const boardSnapshotSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  elements: {
    type: Array,
    required: true,
    default: []
  },
  version: {
    type: Number,
    required: true,
    default: 0
  },
  lastUpdatedBy: {
    type: String, // email or socket ID
    required: false
  }
}, { timestamps: true });

module.exports = mongoose.model('BoardSnapshot', boardSnapshotSchema);
