const express = require('express');
const router = express.Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const Onboarding = require("../models/onboarding");

// Get all notifications for a user
router.get("/", async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .populate("senderId", "name");

    // For each senderId, get onboarding profileImage
    const enrichedNotifications = await Promise.all(
      notifications.map(async (notif) => {
        const onboarding = await Onboarding.findOne({
          userId: notif.senderId._id,
        }).select("profileImage");

        return {
          ...notif._doc,
          sender: {
            _id: notif.senderId._id,
            name: notif.senderId.name,
            profileImage: onboarding?.profileImage || null,
          },
        };
      })
    );

    res.json(enrichedNotifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread notification count
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const count = await Notification.countDocuments({ 
      userId, 
      read: false 
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.patch('/mark-read/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a single notification as unread   
router.patch('/mark-unread/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: false },
      { new: true }
    );
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read for a user
router.patch('/mark-all-read', async (req, res) => {
  try {
    const { userId } = req.body;
    await Notification.updateMany({ userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;