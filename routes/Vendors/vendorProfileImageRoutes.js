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

module.exports = router;
