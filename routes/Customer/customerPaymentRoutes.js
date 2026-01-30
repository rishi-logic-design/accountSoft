const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerPaymentController");

router.get("/", auth, controller.getMyPayments);

module.exports = router;
