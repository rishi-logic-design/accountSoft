const express = require("express");
const router = express.Router();
const reportController = require("../../controllers/vendor/reportController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.get("/product-wise-sales", reportController.getProductWiseSalesReport);

module.exports = router;
