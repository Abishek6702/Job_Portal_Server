const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");

// Send connection request
router.post("/request", async (req, res) => {
  const { senderId, receiverId } = req.body;

  try {
    // Update sender's sentRequests
    await User.findByIdAndUpdate(senderId, {
      $addToSet: { sentRequests: receiverId }
    });

    // Update receiver's pendingRequests
    await User.findByIdAndUpdate(receiverId, {
      $addToSet: { pendingRequests: senderId }
    });

    // Create notification
    const notification = new Notification({
      userId: receiverId,
      senderId: senderId,
      message: "Sent you a connection request",
      type: "connection_request"
    });
    await notification.save();

    // Emit real-time notification (via Socket.IO)
    io.to(receiverId).emit("new-notification", notification);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept connection request
router.post("/accept", async (req, res) => {
  const { senderId, receiverId } = req.body;

  try {
    // Add to connections for both users
    await User.findByIdAndUpdate(senderId, {
      $addToSet: { connections: receiverId },
      $pull: { sentRequests: receiverId }
    });

    await User.findByIdAndUpdate(receiverId, {
      $addToSet: { connections: senderId },
      $pull: { pendingRequests: senderId }
    });

    // Create acceptance notification for sender
    const notification = new Notification({
      userId: senderId,
      senderId: receiverId,
      message: "Accepted your connection request",
      type: "connection_accepted"
    });
    await notification.save();

    // Emit real-time notification
    io.to(senderId).emit("new-notification", notification);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
