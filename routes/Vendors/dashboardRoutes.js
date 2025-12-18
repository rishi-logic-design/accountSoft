const express = require("express");
const router = express.Router();
const dashCtrl = require("../../controllers/vendor/dashboardController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.get("/", auth, role(["admin"]), dashCtrl.getDashboard);

module.exports = router;
