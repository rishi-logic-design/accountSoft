const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerGstNumberController");

router.get("/", auth, controller.getVendorGstNumberForCustomer);
router.post("/", auth, controller.createOrUpdateVendorGstNumberForCustomer);

module.exports = router;
