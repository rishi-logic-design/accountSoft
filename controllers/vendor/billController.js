const billService = require("../../services/vendor/billService");
const { getAvailableTemplates } = require("../../utils/templateRenderer");

exports.createBill = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const bill = await billService.createBill(vendorId, req.body);
    res.status(201).json({
      success: true,
      message: "Bill created successfully",
      data: bill,
    });
  } catch (error) {
    next(error);
  }
};

exports.listBills = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const result = await billService.listBills({ vendorId, ...req.query });
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getBill = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const result = await billService.getBillById(req.params.id, vendorId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.editBill = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const bill = await billService.editBill(req.params.id, vendorId, req.body);
    res.json({
      success: true,
      message: "Bill updated successfully",
      data: bill,
    });
  } catch (error) {
    next(error);
  }
};

exports.markBillPaid = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const result = await billService.markBillPaid(
      req.params.id,
      vendorId,
      req.body,
    );
    res.json({
      success: true,
      message: "Payment recorded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.generateBillPdf = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;

    const pdfBuffer = await billService.generateBillPdf(
      req.params.id,
      vendorId,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=bill-${req.params.id}.pdf`,
    );
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

exports.sendBillWhatsapp = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const result = await billService.getWhatsappLinkForBill(
      req.params.id,
      vendorId,
      req.body.message,
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteBill = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    await billService.deleteBill(req.params.id, vendorId);
    res.json({
      success: true,
      message: "Bill deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.getVendorPendingBillTotal = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const result = await billService.getVendorPendingBillTotal(vendorId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const templates = getAvailableTemplates();
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateBillTemplate = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: "templateId is required",
      });
    }

    const bill = await billService.updateBillTemplate(
      req.params.id,
      vendorId,
      templateId,
    );

    res.json({
      success: true,
      message: "Bill template updated successfully",
      data: bill,
    });
  } catch (error) {
    next(error);
  }
};
