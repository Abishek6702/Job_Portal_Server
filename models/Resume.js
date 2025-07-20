const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: String,
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
  data: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Resume', resumeSchema);
