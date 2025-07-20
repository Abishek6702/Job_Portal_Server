const Resume = require("../models/Resume");
const Template = require("../models/Template");
const puppeteer = require("puppeteer");
const renderHTML = require("../utils/renderer");

exports.createResume = async (req, res) => {
  const { userId, templateId, data } = req.body;
  const resume = await Resume.create({ userId, templateId, data });
  res.status(201).json(resume);
};

exports.getResume = async (req, res) => {
  const resume = await Resume.findById(req.params.id);
  if (!resume) return res.status(404).json({ error: "Not found" });
  res.json(resume);
};

exports.updateResume = async (req, res) => {
  const resume = await Resume.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  res.json(resume);
};

exports.deleteResume = async (req, res) => {
  await Resume.findByIdAndDelete(req.params.id);
  res.status(204).send();
};

exports.renderResume = async (req, res) => {
  const resume = await Resume.findById(req.params.id).populate("templateId");
  if (!resume) return res.status(404).json({ error: "Resume not found" });

  const html = renderHTML(
    resume.templateId.html,
    resume.data,
    resume.templateId.css
  );
  res.send(html);
};

exports.renderResumePDF = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id).populate("templateId");
    if (!resume) return res.status(404).json({ error: "Resume not found" });

    const html = renderHTML(
      resume.templateId.html,
      resume.data,
      resume.templateId.css
    );

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resume.pdf"',
      "Content-Length": pdfBuffer.length,
    });

    return res.end(pdfBuffer);
  } catch (err) {
    console.error("[PDF Error]", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
};
