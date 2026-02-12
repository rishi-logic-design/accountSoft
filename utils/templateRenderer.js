const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");

Handlebars.registerHelper("formatDate", function (date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
});

Handlebars.registerHelper("formatNumber", function (number) {
  if (!number) return "0.00";
  return parseFloat(number).toFixed(2);
});

Handlebars.registerHelper("uppercase", function (text) {
  if (!text) return "";
  return text.toString().toUpperCase();
});

Handlebars.registerHelper("add", function (a, b) {
  return a + b;
});

Handlebars.registerHelper("getStatusColor", function (status) {
  const colors = {
    pending: "#f59e0b",
    paid: "#10b981",
    partial: "#3b82f6",
    cancelled: "#ef4444",
  };
  return colors[status] || "#6b7280";
});

const templateCache = {};

function loadTemplate(templateName) {
  // Check cache first
  if (templateCache[templateName]) {
    return templateCache[templateName];
  }

  const templatePath = path.join(
    __dirname,
    "../templates/invoices",
    `${templateName}.html`,
  );

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template ${templateName} not found at ${templatePath}`);
  }

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const compiledTemplate = Handlebars.compile(templateContent);

  templateCache[templateName] = compiledTemplate;

  return compiledTemplate;
}

function renderTemplate(templateName, data) {
  try {
    const template = loadTemplate(templateName);
    return template(data);
  } catch (error) {
    console.error(`Error rendering template ${templateName}:`, error);
    throw error;
  }
}

function getAvailableTemplates() {
  const templatesDir = path.join(__dirname, "../templates/invoices");

  if (!fs.existsSync(templatesDir)) {
    return [];
  }

  const files = fs.readdirSync(templatesDir);
  const templates = files
    .filter((file) => file.endsWith(".html"))
    .map((file) => {
      const name = file.replace(".html", "");
      return {
        id: name,
        name: getTemplateDisplayName(name),
        description: getTemplateDescription(name),
      };
    });

  return templates;
}

function getTemplateDisplayName(templateId) {
  const names = {
    template1: "Modern Blue",
    template2: "Classic Professional",
    template3: "Minimal Clean",
    template4: "Premium Corporate",
    template5: "Export Invoice",
  };
  return names[templateId] || templateId;
}

function getTemplateDescription(templateId) {
  const descriptions = {
    template1: "Modern design with blue accents and clean layout",
    template2: "Traditional invoice with bordered sections and formal styling",
    template3: "Minimalist design with elegant typography",
    template4: "Professional corporate invoice with detailed sections",
    template5: "Export-ready invoice with comprehensive details",
  };
  return descriptions[templateId] || "";
}

function clearTemplateCache() {
  Object.keys(templateCache).forEach((key) => delete templateCache[key]);
}

module.exports = {
  renderTemplate,
  getAvailableTemplates,
  clearTemplateCache,
};
