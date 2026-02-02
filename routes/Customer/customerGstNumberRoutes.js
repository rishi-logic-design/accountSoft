const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerGstNumberController");

router.get("/", auth, controller.getCustomerGstNumber);
router.post("/", auth, controller.createOrUpdateCustomerGstNumber);

module.exports = router;
