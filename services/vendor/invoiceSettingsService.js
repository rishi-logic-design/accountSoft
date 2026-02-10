const { InvoiceSettingsModel } = require("../../models");
const { getAvailableTemplates } = require("../../utils/templateRenderer");

exports.getInvoiceSettings = async (vendorId) => {
  let settings = await InvoiceSettingsModel.findOne({
    where: { vendorId },
  });

  if (!settings) {
    // Create default settings
    settings = await InvoiceSettingsModel.create({
      vendorId,
      prefix: "INV",
      startCount: 1001,
      currentCount: 1001,
      invoiceTemplate: "template1", // Default template
      usedNumbers: JSON.stringify([]),
    });
  }

  return {
    ...settings.toJSON(),
    usedNumbers: JSON.parse(settings.usedNumbers || "[]"),
  };
};

exports.updateInvoiceSettings = async (vendorId, payload) => {
  const { prefix, startCount, invoiceTemplate } = payload;

  let settings = await InvoiceSettingsModel.findOne({
    where: { vendorId },
  });

  if (!settings) {
    settings = await InvoiceSettingsModel.create({
      vendorId,
      prefix: prefix || "INV",
      startCount: startCount || 1001,
      currentCount: startCount || 1001,
      invoiceTemplate: invoiceTemplate || "template1",
      usedNumbers: JSON.stringify([]),
    });
  } else {
    const updateData = {};

    if (prefix !== undefined) updateData.prefix = prefix;
    if (invoiceTemplate !== undefined)
      updateData.invoiceTemplate = invoiceTemplate;

    // If startCount changed, reset everything
    if (startCount !== undefined && startCount !== settings.startCount) {
      updateData.startCount = startCount;
      updateData.currentCount = startCount;
      updateData.usedNumbers = JSON.stringify([]);
    }

    await settings.update(updateData);
  }

  return {
    ...settings.toJSON(),
    usedNumbers: JSON.parse(settings.usedNumbers || "[]"),
  };
};

exports.getNextInvoiceNumber = async (vendorId, customNumber = null) => {
  const settings = await this.getInvoiceSettings(vendorId);

  let numericPart = settings.currentCount;

  // If custom number requested, check if available
  if (customNumber) {
    const requested = parseInt(customNumber);
    if (
      !isNaN(requested) &&
      !settings.usedNumbers.includes(requested) &&
      requested >= settings.startCount
    ) {
      numericPart = requested;
    }
  }

  return {
    fullNumber: `${settings.prefix}${String(numericPart).padStart(String(settings.startCount).length, "0")}`,
    prefix: settings.prefix,
    numericPart,
    template: settings.invoiceTemplate || "template1",
  };
};

exports.reserveInvoiceNumber = async (vendorId, number) => {
  const settings = await InvoiceSettingsModel.findOne({
    where: { vendorId },
  });

  if (!settings) throw new Error("Invoice settings not found");

  const usedNumbers = JSON.parse(settings.usedNumbers || "[]");

  if (!usedNumbers.includes(number)) {
    usedNumbers.push(number);
  }

  let nextCount = settings.currentCount;
  while (usedNumbers.includes(nextCount)) {
    nextCount++;
  }

  await settings.update({
    usedNumbers: JSON.stringify(usedNumbers),
    currentCount: nextCount,
  });

  return true;
};

exports.checkInvoiceNumberAvailability = async (vendorId, number) => {
  const settings = await this.getInvoiceSettings(vendorId);
  const numericPart = parseInt(number);

  const isAvailable =
    !isNaN(numericPart) &&
    !settings.usedNumbers.includes(numericPart) &&
    numericPart >= settings.startCount;

  return {
    available: isAvailable,
    number: numericPart,
  };
};

exports.getInvoiceTemplatePreview = async (vendorId) => {
  const templates = getAvailableTemplates();

  return {
    templates: templates.map((t) => ({
      ...t,
      preview: `/templates/previews/${t.id}.png`,
    })),
  };
};

