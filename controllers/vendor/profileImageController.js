const asyncHandler = require("../../utils/asyncHandler");
const { VendorModel } = require("../../models");

exports.uploadProfileImage = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId || req.user.id;
  const { profileImage } = req.body;

  console.log("Update Profile Image - Vendor ID:", vendorId);
  console.log("Firebase URL:", profileImage);

  if (!profileImage) {
    return res.status(400).json({
      success: false,
      message: "Profile image URL is required",
    });
  }

  const vendor = await VendorModel.findByPk(vendorId);

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor not found",
    });
  }

  await vendor.update({ profileImage });

  console.log("Profile image URL saved successfully:", profileImage);

  return res.json({
    success: true,
    data: {
      profileImage,
    },
    message: "Profile image updated successfully",
  });
});

exports.getProfileImage = asyncHandler(async (req, res) => {
  const vendorId = req.user.vendorId || req.user.id;

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
  const vendorId = req.user.vendorId || req.user.id;

  const vendor = await VendorModel.findByPk(vendorId);

  if (!vendor) {
    return res.status(404).json({
      success: false,
      message: "Vendor not found",
    });
  }

  // Remove profile image URL
  await vendor.update({ profileImage: null });

  return res.json({
    success: true,
    message: "Profile image deleted successfully",
  });
});
