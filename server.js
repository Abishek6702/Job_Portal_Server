require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const path = require("path");
const cron = require("node-cron");
const Application = require("./models/JobApplication");
const User = require("./models/User");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const companyRoutes = require("./routes/companyRoutes");
const jobRoutes = require("./routes/jobRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");
const applicationRoutes = require("./routes/jobApplicationRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const postRoutes = require("./routes/postRoutes");
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL, // Your frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());

connectDB();

// Socket.IO connection
// In server.js, update socket connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Automatically join user room using token
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id || decoded._id;
      if (userId) {
        socket.join(userId);
        console.log(`User ${userId} joined room`);
      }
    } catch (err) {
      console.error("Token verification failed:", err);
    }
  }

  socket.on("join-user", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room via explicit request`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  // Typing indicators
  socket.on("typing", ({ recipientId, senderId }) => {
    socket.to(recipientId).emit("typing", { senderId });
  });

  socket.on("stop-typing", ({ recipientId }) => {
    socket.to(recipientId).emit("stop-typing");
  });
});

// Make io accessible in routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Your other routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/posts", postRoutes);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Cron job
cron.schedule("*/1 * * * *", async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - 1);

    // Find rejected applications that are older than 1 minute
    const deletedApplications = await Application.find({
      status: "rejected",
      rejectedAt: { $lt: cutoffDate },
    });

    if (deletedApplications.length > 0) {
      // Delete rejected applications older than 1 minute
      const deleteResult = await Application.deleteMany({
        status: "rejected",
        rejectedAt: { $lt: cutoffDate },
      });

      console.log(
        `Deleted ${deleteResult.deletedCount} rejected applications older than 1 minute`
      );

      // For each deleted application, remove the job ID from the user's appliedJobs
      for (const application of deletedApplications) {
        const userId = application.userId;
        const jobId = application.jobId;

        await User.updateOne(
          { _id: userId },
          { $pull: { appliedJobs: jobId } }
        );

        console.log(`Removed job ${jobId} from user ${userId}'s appliedJobs`);
      }
    } else {
      console.log("No rejected applications older than 1 minute to delete.");
    }
  } catch (err) {
    console.error("Error in scheduled job:", err);
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running with Socket.IO on port ${PORT}`);
});
