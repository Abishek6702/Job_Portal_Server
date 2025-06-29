const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Onboarding = require("../models/onboarding");
const { verifyToken } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

// Helper to check ObjectId validity
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/messages/unread-count
 * Returns { senderId: count, ... } for all connections
 */
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    const userId = req.user._id; // Can be ObjectId or string
    const connections = req.user.connections || [];

    // Prepare $match for aggregation
    const matchStage = {
      $expr: {
        $and: [
          { $eq: [{ $toString: "$recipient" }, String(userId)] },
          { $eq: ["$read", false] }
        ]
      }
    };

    if (connections.length > 0) {
      // Accept both ObjectId and string IDs in connections
      const connectionsAsStrings = connections.map(String);
      matchStage.$expr.$and.push({
        $in: [{ $toString: "$sender" }, connectionsAsStrings]
      });
    }

    const unreadCounts = await Message.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $toString: "$sender" },
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {};
    unreadCounts.forEach(item => {
      result[item._id] = item.count;
    });

    res.json(result);
  } catch (err) {
    console.error("Error in GET /unread-count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/messages/:userId
 * Get conversation with a user
 */
router.get("/:userId", verifyToken, async (req, res) => {
  try {
    // Validate only the param, not req.user._id (for string support)
    if (!isValidObjectId(req.params.userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const userId = new mongoose.Types.ObjectId(req.params.userId);
    // Use string or ObjectId for current user
    const currentUserId = isValidObjectId(req.user._id)
      ? new mongoose.Types.ObjectId(req.user._id)
      : req.user._id;

    // Fetch messages and populate sender
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

    // For each message, fetch onboarding data for the sender
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

/**
 * POST /api/messages/
 * Send a message
 */
router.post("/", verifyToken,upload.single("image"), async (req, res) => {
  try {
    const { recipient, content } = req.body;
    const senderId = req.user._id;
    

     let imageUrl = null;
    if (req.file) {
      // Store relative path for frontend access
     imageUrl = `/uploads/resources/${req.file.filename}`;
    }


    // 1. Create and save message
    const message = new Message({ sender: senderId, recipient, content,image: imageUrl });
    await message.save();

    // 2. Populate sender data with profile image
    let populatedMessage = await Message.findById(message._id).populate("sender", "name");
    
    if (populatedMessage.sender && populatedMessage.sender._id) {
      const onboarding = await Onboarding.findOne(
        { userId: populatedMessage.sender._id },
        "profileImage"
      );
      populatedMessage = populatedMessage.toObject();
      populatedMessage.sender.profileImage = onboarding?.profileImage || null;
    }

    // 3. Emit to BOTH sender and recipient
    req.io.to(recipient).emit("new-message", populatedMessage);
    req.io.to(senderId.toString()).emit("new-message", populatedMessage); // Critical fix

    // 4. Update unread count only for recipient (not sender)
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

/**
 * PATCH /api/messages/read/:senderId
 * Mark messages as read from a specific sender
 */
router.patch("/read/:senderId", verifyToken, async (req, res) => {
  try {
    // Accept both ObjectId and string sender IDs
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
