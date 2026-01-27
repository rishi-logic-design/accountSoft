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
    if (req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(404).json({
      success: false,
      message: "Vendor not found",
    });
  }

  if (vendor.profileImage) {
    const oldImagePath = path.join(
      process.cwd(),
      vendor.profileImage.replace("/uploads/", "uploads/"),
    );

    if (fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }
  }

  const imagePath = `/uploads/vendor/${req.file.filename}`;

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
