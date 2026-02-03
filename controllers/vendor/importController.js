const importService = require("../../services/vendor/importService");

exports.importJson = async (req, res, next) => {
  try {
    req.setTimeout(300000); 
    res.setTimeout(300000); 

    const vendorId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Parse JSON file
    let data;
    try {
      const fileContent = req.file.buffer.toString("utf8");
      data = JSON.parse(fileContent);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON file format",
      });
    }

    // Validate data structure
    if (!data || typeof data !== "object") {
      return res.status(400).json({
        success: false,
        message: "Invalid backup file structure",
      });
    }

    // Send immediate response to prevent timeout
    res.status(202).json({
      success: true,
      message: "Import started. Processing in background...",
      status: "processing",
    });

    // Process import in background
    setImmediate(async () => {
      try {
        const result = await importService.processImport(vendorId, data);
        console.log("Background import completed:", result);
      } catch (bgErr) {
        console.error("Background import failed:", bgErr);
      }
    });
  } catch (err) {
    console.error("Import controller error:", err);
    next(err);
  }
};
