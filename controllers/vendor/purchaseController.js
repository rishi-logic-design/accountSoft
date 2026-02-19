const purchaseService = require("../../services/vendor/purchaseService");

exports.createPurchase = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const purchase = await purchaseService.createPurchase(vendorId, req.body);
    res.status(201).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.listPurchases = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { page, size, search, fromDate, toDate } = req.query;
    const result = await purchaseService.listPurchases({
      vendorId,
      page,
      size,
      search,
      fromDate,
      toDate,
    });
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPurchaseById = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    const purchase = await purchaseService.getPurchaseById(id, vendorId);
    res.status(200).json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deletePurchase = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    await purchaseService.deletePurchase(id, vendorId);
    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
