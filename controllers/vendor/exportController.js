const exportService = require("../../services/vendor/exportService");

exports.exportJson = async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const data = await exportService.exportVendorData(vendorId);

    // Set headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=vendor-backup-${Date.now()}.json`,
    );

    return res.json(data);
  } catch (err) {
    console.error("Export controller error:", err);
    next(err);
  }
};
