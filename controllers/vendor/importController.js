const importService = require("../../services/vendor/importService");

exports.importJson = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    if (req.file.mimetype !== "application/json") {
      return res.status(400).json({ message: "Only JSON file allowed" });
    }

    let data;
    try {
      data = JSON.parse(req.file.buffer.toString());
    } catch (e) {
      return res.status(400).json({ message: "Invalid JSON file" });
    }

    const vendorId = req.user.id;

    const result = await importService.processImport(vendorId, data);

    return res.json({
      success: true,
      message: "Import completed",
      result,
    });
  } catch (err) {
    next(err);
  }
};
