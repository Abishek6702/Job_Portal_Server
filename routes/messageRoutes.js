const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Onboarding = require("../models/onboarding");
const { verifyToken } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

// Helper to check ObjectId validity
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// To get the count of unread messages
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const connections = req.user.connections || [];

    const matchStage = {
      $expr: {
        $and: [
          { $eq: [{ $toString: "$recipient" }, String(userId)] },
          { $eq: ["$read", false] },
        ],
      },
    };

    if (connections.length > 0) {
      const connectionsAsStrings = connections.map(String);
      matchStage.$expr.$and.push({
        $in: [{ $toString: "$sender" }, connectionsAsStrings],
      });
    }

    const unreadCounts = await Message.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $toString: "$sender" },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {};
    unreadCounts.forEach((item) => {
      result[item._id] = item.count;
    });

    res.json(result);
  } catch (err) {
    console.error("Error in GET /unread-count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get the conversation of particular user by their ID
router.get("/:userId", verifyToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const userId = new mongoose.Types.ObjectId(req.params.userId);
    const currentUserId = isValidObjectId(req.user._id)
      ? new mongoose.Types.ObjectId(req.user._id)
      : req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
    })
      .sort("createdAt")
      .populate({
        path: "sender",
        select: "name",
      })
      .lean();

    const formattedMessages = await Promise.all(
      messages.map(async (message) => {
        if (message.sender && message.sender._id) {
          const onboarding = await Onboarding.findOne(
            { userId: message.sender._id },
            "profileImage"
          );
          message.sender.profileImage = onboarding?.profileImage || null;
        }
        return message;
      })
    );

    res.json(formattedMessages);
  } catch (err) {
    console.error("Error in GET /:userId", err);
    res.status(500).json({ error: err.message });
  }
});

// To post the messages between the users
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { recipient, content } = req.body;
    const senderId = req.user._id;

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/resources/${req.file.filename}`;
    }

    const message = new Message({
      sender: senderId,
      recipient,
      content,
      image: imageUrl,
    });
    await message.save();

    let populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "name"
    );

    if (populatedMessage.sender && populatedMessage.sender._id) {
      const onboarding = await Onboarding.findOne(
        { userId: populatedMessage.sender._id },
        "profileImage"
      );
      populatedMessage = populatedMessage.toObject();
      populatedMessage.sender.profileImage = onboarding?.profileImage || null;
    }

    req.io.to(recipient).emit("new-message", populatedMessage);
    req.io.to(senderId.toString()).emit("new-message", populatedMessage);

    if (recipient !== senderId.toString()) {
      req.io.to(recipient).emit("update-unread-count", {
        senderId: senderId.toString(),
        increment: true,
      });
    }

    res.status(201).json(populatedMessage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// To make the messages read based on their ID's
router.patch("/read/:senderId", verifyToken, async (req, res) => {
  try {
    const senderId = isValidObjectId(req.params.senderId)
      ? new mongoose.Types.ObjectId(req.params.senderId)
      : req.params.senderId;
    const recipientId = isValidObjectId(req.user._id)
      ? new mongoose.Types.ObjectId(req.user._id)
      : req.user._id;

    await Message.updateMany(
      { sender: senderId, recipient: recipientId, read: false },
      { $set: { read: true } }
    );
    req.io.to(String(recipientId)).emit("update-unread-count", {
      senderId: String(senderId),
      increment: false,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
