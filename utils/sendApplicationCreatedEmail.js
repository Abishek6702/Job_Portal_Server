const sendEmail = require("./sendEmail");
const Job = require("../models/job");

const sendApplicationCreatedEmail = async (to, name, jobId) => {
  let jobTitle = "the position";

  // Try to fetch job title if jobId provided
  if (jobId) {
    try {
      const job = await Job.findById(jobId);
      if (job) jobTitle = job.position;
    } catch (e) {
      console.error("Error fetching job for email:", e.message);
    }
  }

  const subject = `Application Received for ${jobTitle}`;
  const html = `
    <h2>Hello ${name},</h2>
    <p>Thank you for applying for the position of <strong>${jobTitle}</strong>.</p>
    <p>We have received your application and will review it shortly.</p>
    <p>Best regards,<br><strong>Your Company Team</strong></p>
  `;
  const text = `
Hello ${name},

Thank you for applying for the position of ${jobTitle}.

We have received your application and will review it shortly.

Best regards,
Your Company Team
`;

  try {
    await sendEmail(to, subject, text, html);
    console.log("Application creation email sent to:", to);
  } catch (error) {
    console.error("Error sending application creation email:", error.message);
  }
};

module.exports = sendApplicationCreatedEmail;
