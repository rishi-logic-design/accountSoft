const express = require("express");
const router = express.Router();
const authCtrl = require("../../controllers/vendor/authControllers");

router.post("/register", authCtrl.register);
router.post("/login", authCtrl.login);
router.post("/send-otp", authCtrl.sendOtp);
router.post("/verify-otp", authCtrl.verifyOtp);
router.post("/resend-otp", authCtrl.resendOtp);
router.post("/check-role", authCtrl.checkUserRole);

module.exports = router;
