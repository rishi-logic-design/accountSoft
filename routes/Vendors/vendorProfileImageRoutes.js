const express = require("express");
const router = express.Router();
const upload = require("../../middleware/upload");
const controller = require("../../controllers/vendor/profileImageController");
const auth = require("../../middleware/authMiddleware");

router.post(
  "/vendor/profile-image",
  auth,
  upload.single("profileImage"),
  controller.uploadProfileImage,
);

router.get("/vendor/profile-image", auth, controller.getProfileImage);

router.delete("/vendor/profile-image", auth, controller.deleteProfileImage);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
});

module.exports = router;
    