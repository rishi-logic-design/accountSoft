const asyncHandler = require("../../utils/asyncHandler");
const { VendorModel } = require("../../models");
const fs = require("fs");
const path = require("path");

exports.uploadProfileImage = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId;

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
    const oldImagePath = path.join(__dirname, "../..", vendor.profileImage);
    if (fs.existsSync(oldImagePath)) {
      try {
        fs.unlinkSync(oldImagePath);
      } catch (err) {
        console.error("Error deleting old image:", err);
      }
    }
  }

  const imagePath = `/uploads/vendor/${req.file.filename}`;

  await vendor.update({
    profileImage: imagePath,
  });

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

exports.deleteProfileImage = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId;

  const vendor = await VendorModel.findByPk(vendorId);

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor not found",
    });
  }

  // Delete image file if exists
  if (vendor.profileImage) {
    const imagePath = path.join(__dirname, "../..", vendor.profileImage);
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        console.error("Error deleting image:", err);
      }
    }
  }

  // Update database
  await vendor.update({
    profileImage: null,
  });

  return res.json({
    success: true,
    message: "Profile image deleted successfully",
  });
});
