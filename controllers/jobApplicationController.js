const mongoose = require("mongoose");
const Application = require("../models/JobApplication");
const User = require("../models/User");
const Job = require("../models/job");
const Onboarding = require("../models/onboarding");
const sendStatusEmail = require("../utils/sendStatusMail");
const path = require("path");

exports.createApplication = async (req, res) => {
  try {
    const {
      jobId,
      companyId,
      name,
      email,
      phone,
      experience,
      location,
      questionsAndAnswers,
    } = req.body;

    let resume;
    if (req.file) {
      resume = req.file.filename; // New upload
    } else if (req.body.resumePath) {
      resume = req.body.resumePath; // Existing resume
    } else {
      return res.status(400).json({ message: "Resume is required." });
    }
    const existingApplication = await Application.findOne({
      userId: req.user._id,
      jobId,
    });
    if (existingApplication) {
      return res
        .status(409)
        .json({ message: "You have already applied for this job." });
    }

    const onboarding = await Onboarding.findOne({
      userId: req.user._id,
    }).select("education experience");
    if (!onboarding) {
      return res.status(404).json({ message: "Onboarding data not found." });
    }

    const newApp = new Application({
      userId: req.user._id,
      jobId,
      companyId,
      name,
      email,
      phone,
      location,
      experience,
      resume,
      education: onboarding.education,
      experienceDetails: onboarding.experience,
      questionsAndAnswers: JSON.parse(questionsAndAnswers || "[]"),
    });

    const savedApp = await newApp.save();

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { appliedJobs: jobId },
    });

    res.status(201).json(savedApp);
  } catch (err) {
    console.error("Application creation error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllApplications = async (req, res) => {
  try {
    const applications = await Application.find()
  .populate("userId")
  .populate({
    path: "jobId",
    populate: {
      path: "companyId",
    },
  })
    const applicationsWithDownloadLink = applications.map((app) => {
      const resumeDownloadLink = `http://localhost:3000/download/${app._id}`;
      return {
        ...app.toObject(),

        resumeDownloadLink,
      };
    });
    res.status(200).json(applicationsWithDownloadLink);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const app = await Application.findById(req.params.id).populate(
      "userId jobId companyId"
    );
    if (!app) return res.status(404).json({ message: "Application not found" });
    res.status(200).json(app);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteApplication = async (req, res) => {
  try {
    const app = await Application.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });

    // Remove jobId from user's appliedJobs
    await User.findByIdAndUpdate(app.userId, {
      $pull: { appliedJobs: app.jobId },
    });

    res.status(200).json({ message: "Application deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.


getApplicationsForJob = async (req, res) => {
  try {
    
    const jobId = req.params.jobId;
    // console.log("🔍 jobId from params:", jobId);

    // Fetch job and populate company info
    const job = await Job.findById(jobId).populate("companyId");
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // console.log("📄 Job found:", job);
    // console.log("🏢 Populated companyId:", job.companyId);

    // Ensure company exists and has a createdBy field
    if (!job.companyId || !job.companyId.createdBy) {
      return res.status(403).json({ message: "Company or owner info missing" });
    }

    // console.log("🧑‍💼 company.createdBy:", job.companyId.createdBy);
    // console.log("🪪 req.user._id:", req.user._id);

    // Check if the logged-in user is the creator of the company
    if (job.companyId.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to view applications for this job" });
    }

    // Fetch applications for this job
    const applications = await Application.find({ jobId }).populate("userId");
    res.status(200).json(applications);
  } catch (err) {
    console.error("🔥 Error in getApplicationsForJob:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAppliedJobs = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select("appliedJobs");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ appliedJobs: user.appliedJobs });
  } catch (error) {
    console.error("Error fetching applied jobs:", error);
    res.status(500).json({ error: "Server error" });
  }
};
// Add this new route to your application controller
exports.downloadResume = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application || !application.resume) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumePath = path.join(
      __dirname,
      "../uploads/resumes",
      application.resume
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resume-${application._id}.pdf"`
    );

    res.sendFile(resumePath);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const { id } = req.params;

    if (
      !["in progress", "rejected", "selected", "not selected"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    application.status = status;

    // Only update notes if provided
    if (typeof notes === "string") {
      application.notes = notes;
    }

    if (status === "rejected") {
      application.rejectedAt = new Date();
    } else {
      application.rejectedAt = null;
    }

    // Fetch the job title using the jobId
    const job = await Job.findById(application.jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const jobTitle = job.position; // Assuming 'title' is the field for job title

    // Save the updated application
    await application.save();

    // Send email if the status is selected, rejected, or not selected

    try {
      if (["selected", "rejected", "not selected"].includes(status)) {
        console.log("controller application email", application.email);
        await sendStatusEmail(
          application.email,
          status,
          application.name,
          jobTitle
        );
        console.log("EMAIL TO SEND:", application.email);
      }
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr.message);
    }

    res
      .status(200)
      .json({ message: "Status updated successfully", application });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkUpdateApplicationStatus = async (req, res) => {
  try {
    const { ids, status, notes } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ message: "IDs should be a non-empty array" });
    }

    const areValidObjectIds = ids.every((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (!areValidObjectIds) {
      return res.status(400).json({ message: "One or more IDs are invalid" });
    }

    const validStatuses = [
      "in progress",
      "rejected",
      "selected",
      "not selected",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Prepare update fields
    const updateData = {
      status,
      rejectedAt: status === "rejected" ? new Date() : null,
    };
    if (typeof notes === "string") {
      updateData.notes = notes;
    }

    // Fetch applications before updating
    const applications = await Application.find({ _id: { $in: ids } });

    if (applications.length === 0) {
      return res
        .status(404)
        .json({ message: "No applications found to update" });
    }

    // Fetch job titles for applications
    const jobTitles = await Job.find({
      _id: { $in: applications.map((app) => app.jobId) },
    })
      .lean()
      .then((jobs) =>
        jobs.reduce((acc, job) => {
          acc[job._id] = job.position;
          return acc;
        }, {})
      );

    // Perform the update
    await Application.updateMany({ _id: { $in: ids } }, { $set: updateData });

    // Send email to each matched applicant if applicable
    const emailPromises = applications.map(async (app) => {
      try {
        // Fetch job title from the cached job titles
        const jobTitle = jobTitles[app.jobId];
        if (
          jobTitle &&
          ["selected", "rejected", "not selected"].includes(status)
        ) {
          await sendStatusEmail(app.email, status, app.name, jobTitle);
        }
      } catch (emailErr) {
        console.error(`Error sending email to ${app.email}:`, emailErr.message);
      }
    });

    // Wait for all email promises to resolve
    await Promise.all(emailPromises);

    res.status(200).json({
      message: "Bulk status update completed and emails sent",
      matchedCount: applications.length,
      modifiedCount: applications.length,
    });
  } catch (err) {
    console.error("Bulk status update error:", err);
    res.status(500).json({ error: err.message });
  }
};
