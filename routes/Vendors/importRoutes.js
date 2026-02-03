const express = require("express");
const multer = require("multer");
const auth = require("../../middleware/authMiddleware");

const importController = require("../../controllers/vendor/importController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/json", auth, upload.single("file"), importController.importJson);

module.exports = router;
