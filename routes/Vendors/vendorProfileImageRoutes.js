const express = require("express");
const router = express.Router();
const controller = require("../../controllers/vendor/profileImageController");
const auth = require("../../middleware/authMiddleware");
router.post("/image", controller.uploadProfileImage);

router.get("/vendor/profile-image", auth, controller.getProfileImage);

module.exports = router;
