const express = require("express");
const router = express.Router();
const reportController = require("../../controllers/vendor/reportController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.get("/product-wise-sales", reportController.getProductWiseSalesReport);
router.get(
  "/product-wise-purchase",
  reportController.getProductWisePurchaseReport,
);
router.get("/party-wise-sales", reportController.getPartyWiseSalesReport);
router.get("/party-wise-purchase", reportController.getPartyWisePurchaseReport);
router.get("/gst-sales", reportController.getGSTSalesReport);
router.get("/gst-purchase", reportController.getGSTPurchaseReport);

module.exports = router;
