const express = require("express");
const router = express.Router();
const authCtrl = require("../../controllers/customer/customerAuthController");

router.post("/request-otp", authCtrl.requestOtp);
router.post("/verify-otp", authCtrl.verifyOtp);

module.exports = router;
