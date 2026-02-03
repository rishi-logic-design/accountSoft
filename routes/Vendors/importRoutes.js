const express = require("express");
const auth = require("../../middleware/authMiddleware");
const exportController = require("../../controllers/vendor/exportController");

const router = express.Router();

router.get("/json", auth, exportController.exportJson);

module.exports = router;
