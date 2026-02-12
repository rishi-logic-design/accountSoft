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

exports.getBillHtml = async (req, res, next) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const BillModel = require("../../models/vendor/billModel");
    const InvoiceSettingsModel = require("../../models/vendor/invoiceSettingsModel");

    const bill = await BillModel.findOne({
      _id: req.params.id,
      vendorId,
    }).populate(
      "customerId",
      "customerName company mobileNumber homeAddress gstNumber businessName",
    );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }
    const settings = await InvoiceSettingsModel.findOne({ vendorId });
    const templateId =
      bill.invoiceTemplate || settings?.invoiceTemplate || "template1";
    const formatAddress = (address) => {
      if (!address) return "Address not provided";
      try {
        const addr =
          typeof address === "string" ? JSON.parse(address) : address;
        const parts = [
          addr.houseNo,
          addr.streetNo,
          addr.residencyName,
          addr.areaCity,
          addr.state,
          addr.pincode,
        ].filter(Boolean);
        return parts.join(", ");
      } catch (e) {
        return address;
      }
    };

    const templateData = {
      billNumber: bill.billNumber,
      date: bill.date || new Date(),
      dueDate: bill.dueDate,
      customer: {
        name: bill.customerId?.customerName || "N/A",
        company:
          bill.customerId?.company || bill.customerId?.businessName || "",
        address: formatAddress(bill.customerId?.homeAddress),
        gstNumber: bill.customerId?.gstNumber || "",
        phone: bill.customerId?.mobileNumber || "",
      },
      items: bill.items || [],
      subtotal: bill.subtotal || bill.totalWithoutGST || 0,
      gstPercentage: bill.gstPercentage || 18,
      gstTotal: bill.gstTotal || bill.gst || 0,
      totalAmount: bill.totalWithGST || bill.totalAmount || 0,
      paidAmount: bill.paidAmount || 0,
      pendingAmount: bill.pendingAmount || 0,
      status: bill.status || "pending",
      notes: bill.notes || "",
    };
    const html = renderTemplate(templateId, templateData);
    res.json({
      success: true,
      data: {
        html,
        templateId,
        billNumber: bill.billNumber,
      },
    });
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
