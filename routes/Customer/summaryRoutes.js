const express = require("express");
const router = express.Router();
const summaryCtrl = require("../../controllers/customer/summaryController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin"]));

router.get("/", summaryCtrl.getSummary);

module.exports = router;
