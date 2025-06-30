const Onboarding = require("../models/onboarding");
const User = require("../models/User");

exports.saveOrUpdateOnboarding = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }

    let data = req.body;

    // Parse JSON fields if sent as strings
    if (typeof data.education === "string")
      data.education = JSON.parse(data.education);
    if (typeof data.experience === "string")
      data.experience = JSON.parse(data.experience);
    if (typeof data.preferredRoles === "string")
      data.preferredRoles = JSON.parse(data.preferredRoles);
    if (typeof data.skills === "string") {
      try {
        data.skills = JSON.parse(data.skills);
      } catch {
        data.skills = data.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    // Attach file paths if files are present
    if (req.files) {
      if (req.files.profileImage)
        data.profileImage = req.files.profileImage[0].path;
      if (req.files.resume) data.resume = req.files.resume[0].path;
    }

    // Ensure userId is included in update filter and data
    await Onboarding.updateOne(
      { userId: userId },
      { $set: { ...data, userId: userId } },
      { upsert: true }
    );

    // Update user state
    await User.findByIdAndUpdate(userId, {
      onboardingCompleted: true,
      firstTimeLogin: false,
    });

    res.status(200).json({ message: "Onboarding data saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.getOnboarding = async (req, res) => {
  try {
    const userId = req.params.userId;
    const onboarding = await Onboarding.findOne({ userId });
    if (!onboarding)
      return res.status(404).json({ message: "Record not found" });
    res.status(200).json(onboarding);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfileImage = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const onboarding = await Onboarding.findOneAndUpdate(
      { userId },
      { profileImage: req.file.path },
      { new: true }
    );

    if (!onboarding) {
      return res.status(404).json({ message: "Onboarding record not found" });
    }

    res.status(200).json({
      message: "Profile image updated",
      profileImage: onboarding.profileImage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateResume = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const onboarding = await Onboarding.findOneAndUpdate(
      { userId },
      { resume: req.file.path },
      { new: true }
    );

    if (!onboarding) {
      return res.status(404).json({ message: "Onboarding record not found" });
    }

    res.status(200).json({
      message: "Resume updated",
      resume: onboarding.resume,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.upsertBannerImage = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const onboarding = await Onboarding.findOneAndUpdate(
      { userId },
      { banner: req.file.path },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: "Banner image uploaded",
      banner: onboarding.banner,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
