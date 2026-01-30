const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerVendorPaymentController");

router.get("/", auth, controller.getVendorPaymentDetailsForCustomer);

module.exports = router;
