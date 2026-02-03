const express = require("express");
const multer = require("multer");
const auth = require("../../middleware/authMiddleware");
const importController = require("../../controllers/vendor/importController");
const exportController = require("../../controllers/vendor/exportController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Import route
router.post(
  "/import/json",
  auth,
  upload.single("file"),
  importController.importJson,
);

// Export route
router.get("/json", auth, exportController.exportJson);

module.exports = router;
