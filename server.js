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
const messageRoutes = require('./routes/messageRoutes');
const postRoutes =  require("./routes/postRoutes");
const resumeRoutes = require("./routes/resumeRoutes");
const templateRoutes = require("./routes/templateRoutes");
const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "https://job-portal-client-eosin-chi.vercel.app",
  "https://job-portal-client-git-main-abisheks-projects-b2a0a1da.vercel.app"
];
// Frontend ports allowed
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});


// Frontend ports allowed


app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
connectDB();

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  
  // Automatically join user room using token
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
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

// Application routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use('/api/messages', messageRoutes);
app.use("/api/posts",postRoutes);
app.use("/api/resumes",resumeRoutes);
app.use("/api/templates",templateRoutes)


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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running with Socket.IO on port ${PORT}`);
});
