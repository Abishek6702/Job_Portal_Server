const sendEmail = require("./sendEmail");

const sendStatusEmail = async (
  to,
  status,
  name = "Applicant",
  jobTitle = "the position"
) => {
  let subject = "";
  let html = "";
  let text = "";

  switch (status) {
    case "selected":
      subject = `🎉 Congratulations! You've been selected for ${jobTitle}`;
      html = `
        <h2>Hello ${name},</h2>
        <p>We are pleased to inform you that you've been <strong>selected</strong> for the position of <strong>${jobTitle}</strong>.</p>
        <p>We'll follow up shortly with the next steps.</p>
        <p>Thank you for your interest in joining us.</p>
        <p>Best regards,<br><strong>Your Company Team</strong></p>
      `;
      text = `Hello ${name},\n\nWe are pleased to inform you that you've been selected for the position of ${jobTitle}.\n\nWe'll follow up shortly with the next steps.\n\nThank you for your interest in joining us.\n\nBest regards,\nYour Company Team`;
      break;

    case "rejected":
      subject = `Application Update: Rejected for ${jobTitle}`;
      html = `
        <h2>Dear ${name},</h2>
        <p>Thank you for applying for the <strong>${jobTitle}</strong> role.</p>
        <p>After review, we regret to inform you that your application has been rejected.</p>
        <p>We encourage you to apply for future openings.</p>
        <p>Sincerely,<br><strong>Your Company Team</strong></p>
      `;
      text = `Dear ${name},\n\nThank you for applying for the ${jobTitle} role.\n\nAfter review, we regret to inform you that your application has been rejected.\n\nWe encourage you to apply for future openings.\n\nSincerely,\nYour Company Team`;
      break;

    case "not selected":
      subject = `Application Status: Not Selected for ${jobTitle}`;
      html = `
        <h2>Hello ${name},</h2>
        <p>We appreciate your interest in the <strong>${jobTitle}</strong> position.</p>
        <p>At this time, you have not been selected.</p>
        <p>Thank you, and we wish you the best moving forward.</p>
        <p>Warm regards,<br><strong>Your Company Team</strong></p>
      `;
      text = `Hello ${name},\n\nWe appreciate your interest in the ${jobTitle} position.\n\nAt this time, you have not been selected.\n\nThank you, and we wish you the best moving forward.\n\nWarm regards,\nYour Company Team`;
      break;

    default:
      return;
  }

  try {
    await sendEmail(to, subject, text, html);
    console.log("Email sent to:", to);
  } catch (emailErr) {
    console.error("Error sending email:", emailErr.message);
    throw emailErr;
  }
};

module.exports = sendStatusEmail;
