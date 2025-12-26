const asyncHandler = require("../utils/asyncHandler");
const { success, error } = require("../utils/apiResponse");
const path = require("path");
const fs = require("fs");

exports.uploadCustomerImage = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Upload Customer Image Request");

  if (!req.file) {
    console.log("❌ No file uploaded");
    return error(res, "Please upload an image file", 400);
  }

  console.log("✅ File uploaded:", req.file.filename);

  const imageUrl = `/uploads/customers/${req.file.filename}`;

  success(res, { imageUrl }, "Image uploaded successfully", 201);
});

exports.deleteCustomerImage = asyncHandler(async (req, res) => {
  console.log("🔥 Incoming Delete Customer Image Request");

  const { imageUrl } = req.body;

  if (!imageUrl) {
    return error(res, "Image URL is required", 400);
  }

  const filename = path.basename(imageUrl);
  const filePath = path.join(__dirname, "../uploads/customers", filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log("✅ Image deleted:", filename);
    success(res, null, "Image deleted successfully");
  } else {
    console.log("❌ Image not found:", filename);
    return error(res, "Image not found", 404);
  }
});