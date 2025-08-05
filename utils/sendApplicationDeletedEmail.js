const sendEmail = require("./sendEmail");
const Job = require("../models/job");

const sendApplicationDeletedEmail = async (to, name, jobId) => {
  let jobTitle = "the position";

  if (jobId) {
    try {
      const job = await Job.findById(jobId);
      if (job) jobTitle = job.position;
    } catch (e) {
      console.error("Error fetching job for email:", e.message);
    }
  }

  const subject = `Application Deleted for ${jobTitle}`;
  const html = `
    <h2>Hello ${name},</h2>
    <p>Your application for the position of <strong>${jobTitle}</strong> has been deleted.</p>
    <p>If this was a mistake or you have any questions, please contact us.</p>
    <p>Best regards,<br><strong>Your Company Team</strong></p>
  `;
  const text = `
Hello ${name},

Your application for the position of ${jobTitle} has been deleted.

If this was a mistake or you have any questions, please contact us.

Best regards,
Your Company Team
`;

  try {
    await sendEmail(to, subject, text, html);
    console.log("Application deletion email sent to:", to);
  } catch (error) {
    console.error("Error sending application deletion email:", error.message);
  }
};

module.exports = sendApplicationDeletedEmail;
