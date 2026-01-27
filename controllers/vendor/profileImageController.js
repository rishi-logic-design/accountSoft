const asyncHandler = require("../../utils/asyncHandler");
const { VendorModel } = require("../../models");
const fs = require("fs");
const path = require("path");

exports.uploadProfileImage = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId;

  console.log("Upload Request - Vendor ID:", vendorId);
  console.log("File received:", req.file);

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Profile image is required",
    });
  }

  const vendor = await VendorModel.findByPk(vendorId);

  if (!vendor) {
    // Delete uploaded file
    if (req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(404).json({
      success: false,
      message: "Vendor not found",
    });
  }

  // Delete old image
  if (vendor.profileImage) {
    const oldImagePath = path.join(__dirname, "../..", vendor.profileImage);
    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }
  }

  // Save image path
  const imagePath = `/uploads/vendor/${req.file.filename}`;

  // Update vendor
  await vendor.update({ profileImage: imagePath });

  console.log("Image saved successfully:", imagePath);

  return res.json({
    success: true,
    data: {
      profileImage: imagePath,
    },
    message: "Profile image updated successfully",
  });
});

exports.getProfileImage = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId;
  const vendor = await VendorModel.findByPk(vendorId);

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor not found",
    });
  }

  return res.json({
    success: true,
    data: {
      profileImage: vendor.profileImage || null,
    },
  });
});
