const asyncHandler = require("../utils/asyncHandler");
const { success, error } = require("../utils/apiResponse");
const path = require("path");

exports.uploadAttachment = asyncHandler(async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    return error(res, "No file uploaded", 400);
  }

  const vendorId =
    req.user?.role === "vendor"
      ? req.user.id
      : req.body.vendorId || req.user.id;

  if (!vendorId) {
    return error(res, "Vendor ID is required", 400);
  }

  // File information
  const file = req.file;
  const fileUrl = `/uploads/vendor/${file.filename}`;

  // Return file information
  const fileData = {
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    url: fileUrl,
    fileUrl: fileUrl, // Duplicate for compatibility
    path: file.path,
    uploadedAt: new Date(),
  };

  success(res, fileData, "File uploaded successfully", 201);
});

exports.deleteAttachment = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const fs = require("fs");
  const uploadPath = path.join(process.cwd(), "uploads", "vendor", filename);

  if (!fs.existsSync(uploadPath)) {
    return error(res, "File not found", 404);
  }

  try {
    fs.unlinkSync(uploadPath);
    success(res, null, "File deleted successfully");
  } catch (err) {
    console.error("Error deleting file:", err);
    return error(res, "Failed to delete file", 500);
  }
});
