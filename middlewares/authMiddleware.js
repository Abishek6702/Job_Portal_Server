const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
// const Resume = require("../models/Resume");
// const Course = require("../models/Course");
// const Lesson = require("../models/Lesson");
// const Video = require("../models/Video");

exports.verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.id) throw new Error("Invalid token payload: missing id");

    // Attach user to request
    req.user = {
      _id: decoded.id, // Use decoded.id as _id for consistency
      connections: decoded.connections || [], // Use the correct field name!
    };
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid token" });
  }
};

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (
      !roles
        .map((role) => role.toLowerCase())
        .includes(req.user.role.toLowerCase())
    ) {
      return res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

// exports.checkResumeOwnership = async (req, res, next) => {
//   try {
//     const resume = await Resume.findById(req.params.id);

//     if (!resume) {
//       return res.status(404).json({ error: "Resume not found" });
//     }

//     if (resume.userId.toString() !== req.user._id.toString()) {
//       return res
//         .status(403)
//         .json({ error: "You do not have permission to access this resume" });
//     }

//     next();
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// exports.checkCourseOwnership = async (req, res, next) => {
//   try {
//     let courseId = req.body.courseId || req.params.courseId;
//     let lessonId = req.body.lessonId || req.params.lessonId;
//     let videoId =
//       req.body.videoId || (!lessonId && req.params.id ? req.params.id : null);

//     if (!lessonId && videoId) {
//       const video = await Video.findById(videoId);
//       if (!video) {
//         return res.status(404).json({ error: "Video not found" });
//       }
//       lessonId = video.lessonId;
//     }

//     if (!courseId && lessonId) {
//       const objectLessonId = new mongoose.Types.ObjectId(lessonId);
//       const course = await Course.findOne({
//         courseContent: { $in: [objectLessonId] },
//       });

//       if (!course) {
//         return res
//           .status(404)
//           .json({ error: "Course not found for this lesson" });
//       }

//       courseId = course._id;
//     }

//     if (!courseId) {
//       return res
//         .status(400)
//         .json({ error: "Course ID is required or could not be resolved" });
//     }

//     const course = await Course.findById(courseId);
//     if (!course) {
//       return res.status(404).json({ error: "Course not found" });
//     }

//     if (
//       req.user.role !== "admin" &&
//       course.instructorDetails.toString() !== req.user._id.toString()
//     ) {
//       return res
//         .status(403)
//         .json({ error: "You do not have permission to manage this course" });
//     }

//     next();
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };
