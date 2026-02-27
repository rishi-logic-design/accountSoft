const reportService = require("../../services/vendor/reportService");

exports.getProductWiseSalesReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getProductWiseSalesReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductWisePurchaseReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getProductWisePurchaseReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPartyWiseSalesReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getPartyWiseSalesReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPartyWisePurchaseReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getPartyWisePurchaseReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGSTSalesReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getGSTSalesReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getGSTPurchaseReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getGSTPurchaseReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInvoiceDetailsReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getInvoiceDetailsReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPurchaseDetailsReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getPurchaseDetailsReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCurrentStockReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { search, page, size } = req.query;
    const result = await reportService.getCurrentStockReport(vendorId, {
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDeliveryChallanReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getDeliveryChallanReport(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDeliveryChallanDetailsReport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getDeliveryChallanDetailsReport(
      vendorId,
      {
        fromDate,
        toDate,
        search,
        page,
        size,
      },
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActivityLogs = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { fromDate, toDate, search, page, size } = req.query;
    const result = await reportService.getActivityLogs(vendorId, {
      fromDate,
      toDate,
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBulkExports = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { page, size } = req.query;
    const result = await reportService.getBulkExports(vendorId, { page, size });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBulkExport = async (req, res) => {
  try {
    const vendorId = req.user.vendorId || req.user.id;
    const { documentType, fromDate, toDate } = req.body;
    const result = await reportService.createBulkExport(vendorId, {
      documentType,
      fromDate,
      toDate,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
