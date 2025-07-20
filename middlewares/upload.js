const multer = require("multer");
const path = require("path");

// Set allowed file types
const allowedVideoTypes = ["video/mp4", "video/avi", "video/mkv", "video/mov"];
const allowedResourceTypes = [
  "application/pdf",
  "application/zip",
  "application/octet-stream",
  "text/html",
  "image/jpeg",
  "image/png",
];

// To make the file uploads and save those in resources folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, "uploads/videos/");
    } else if (allowedResourceTypes.includes(file.mimetype)) {
      cb(null, "uploads/resources/");
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    allowedVideoTypes.includes(file.mimetype) ||
    allowedResourceTypes.includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only video or resource files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
});

module.exports = upload;
