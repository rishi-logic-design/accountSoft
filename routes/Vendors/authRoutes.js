const express = require("express");
const router = express.Router();
const authCtrl = require("../../controllers/vendor/authControllers");
const { auth } = require("../../middleware/authMiddleware");

router.post("/register", authCtrl.register);
router.post("/login", authCtrl.login);

router.get("/me", auth, authCtrl.getLoginDetail);
router.put("/update-profile", auth, authCtrl.updateProfile);

router.post("/send-otp", authCtrl.sendOtp);
router.post("/verify-otp", authCtrl.verifyOtp);
router.post("/resend-otp", authCtrl.resendOtp);

router.post("/check-user-role", authCtrl.checkUserRole);

router.post("/exchange-firebase-token", authCtrl.exchangeFirebaseToken);

router.post("/vendor/check", authCtrl.checkVendor);

router.post("/vendor/send-otp", authCtrl.sendVendorOtp);
router.post("/vendor/verify-otp", authCtrl.verifyVendorOtp);
router.post("/vendor/resend-otp", authCtrl.resendVendorOtp);

router.post(
  "/vendor/exchange-firebase-token",
  authCtrl.exchangeVendorFirebaseToken,
);

router.post("/customer/check", authCtrl.checkCustomer);
3;
router.post("/customer/send-otp", authCtrl.sendCustomerOtp);
router.post("/customer/verify-otp", authCtrl.verifyCustomerOtp);
router.post("/customer/resend-otp", authCtrl.resendCustomerOtp);
router.post(
  "/customer/exchange-firebase-token",
  authCtrl.exchangeCustomerFirebaseToken,
);

module.exports = router;
