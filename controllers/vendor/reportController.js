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
