const { InvoiceSettingsModel, BillModel, sequelize } = require("../../models");
const { Op } = require("sequelize");


exports.getInvoiceSettings = async (vendorId) => {
  if (!vendorId) throw new Error("vendorId is required");

  let settings = await InvoiceSettingsModel.findOne({
    where: { vendorId },
  });

  if (!settings) {
    settings = await InvoiceSettingsModel.create({
      vendorId,
      prefix: "INV",
      startCount: 1001,
      currentCount: 1001,
      invoiceTemplate: "template1",
      usedNumbers: [],
    });
  }

  return settings;
};


exports.updateInvoiceSettings = async (vendorId, payload) => {
  if (!vendorId) throw new Error("vendorId is required");

  const settings = await this.getInvoiceSettings(vendorId);

  const updateData = {};

  if (payload.prefix !== undefined) {
    updateData.prefix = payload.prefix.toUpperCase().trim();
  }

  if (payload.startCount !== undefined) {
    const newStartCount = parseInt(payload.startCount);
    if (newStartCount < 1) {
      throw new Error("Start count must be at least 1");
    }
    updateData.startCount = newStartCount;
    updateData.currentCount = newStartCount;
    updateData.usedNumbers = [];
  }

  if (payload.invoiceTemplate !== undefined) {
    if (
      !["template1", "template2", "template3"].includes(payload.invoiceTemplate)
    ) {
      throw new Error("Invalid invoice template");
    }
    updateData.invoiceTemplate = payload.invoiceTemplate;
  }

  await settings.update(updateData);

  return settings;
};


exports.getNextInvoiceNumber = async (vendorId, requestedNumber = null) => {
  const settings = await this.getInvoiceSettings(vendorId);
  const usedNumbers = settings.usedNumbers || [];

  let invoiceNumber;

  if (requestedNumber !== null) {
    const numericPart = parseInt(requestedNumber);

    if (isNaN(numericPart) || numericPart < 1) {
      throw new Error("Invalid invoice number");
    }

    if (usedNumbers.includes(numericPart)) {
      throw new Error(
        `Invoice number ${numericPart} is already used. Please use the next sequential number.`,
      );
    }

    const expectedNext = settings.currentCount;
    if (numericPart !== expectedNext) {
      throw new Error(
        `You must use invoice number ${expectedNext}. Skipping numbers is not allowed.`,
      );
    }

    invoiceNumber = numericPart;
  } else {
    invoiceNumber = settings.currentCount;

    while (usedNumbers.includes(invoiceNumber)) {
      invoiceNumber++;
    }
  }

  return {
    fullNumber: `${settings.prefix}${String(invoiceNumber).padStart(String(settings.startCount).length, "0")}`,
    numericPart: invoiceNumber,
    prefix: settings.prefix,
    template: settings.invoiceTemplate,
  };
};


exports.reserveInvoiceNumber = async (vendorId, numericPart) => {
  return await sequelize.transaction(async (t) => {
    const settings = await InvoiceSettingsModel.findOne({
      where: { vendorId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!settings) throw new Error("Invoice settings not found");

    const usedNumbers = settings.usedNumbers || [];

    if (usedNumbers.includes(numericPart)) {
      throw new Error("Invoice number already used");
    }

    usedNumbers.push(numericPart);

    const newCurrentCount = numericPart + 1;

    await settings.update(
      {
        usedNumbers,
        currentCount: newCurrentCount,
      },
      { transaction: t },
    );

    return settings;
  });
};


exports.checkInvoiceNumberAvailability = async (vendorId, numericPart) => {
  const settings = await this.getInvoiceSettings(vendorId);
  const usedNumbers = settings.usedNumbers || [];

  const isUsed = usedNumbers.includes(parseInt(numericPart));
  const expectedNext = settings.currentCount;
  const isSequential = parseInt(numericPart) === expectedNext;

  return {
    available: !isUsed && isSequential,
    isUsed,
    isSequential,
    expectedNext,
    message: isUsed
      ? `Number ${numericPart} is already used`
      : !isSequential
        ? `You must use ${expectedNext}. Skipping numbers is not allowed.`
        : "Number is available",
  };
};


exports.getInvoiceTemplatePreview = async (vendorId) => {
  const settings = await this.getInvoiceSettings(vendorId);

  return {
    currentTemplate: settings.invoiceTemplate,
    templates: [
      {
        id: "template1",
        name: "Classic Template",
        description: "Traditional invoice layout with company header",
        preview: "/templates/preview1.png",
      },
      {
        id: "template2",
        name: "Modern Template",
        description: "Clean and modern design with color accents",
        preview: "/templates/preview2.png",
      },
      {
        id: "template3",
        name: "Minimal Template",
        description: "Simple and minimalist invoice format",
        preview: "/templates/preview3.png",
      },
    ],
  };
};
