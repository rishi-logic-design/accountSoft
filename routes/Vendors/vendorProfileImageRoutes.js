const express = require("express");
const router = express.Router();
const controller = require("../../controllers/vendor/profileImageController");
const auth = require("../../middleware/authMiddleware");

router.post("/image", auth, controller.uploadProfileImage);

router.get("/image", auth, controller.getProfileImage);

module.exports = router;
