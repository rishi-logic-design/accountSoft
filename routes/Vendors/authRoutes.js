const express = require("express");
const router = express.Router();
const authCtrl = require("../../controllers/vendor/authControllers");
const auth = require("../../middleware/authMiddleware");

router.post("/register", authCtrl.register);
router.post("/login", authCtrl.login);

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
  authCtrl.exchangeVendorFirebaseToken
);
router.use(auth);

router.get("/firm", authCtrl.getFirm);
router.post("/firm", authCtrl.upsertFirm);

router.post("/gst", authCtrl.createGstSlab);
router.get("/gst", authCtrl.listGstSlabs);
router.get("/gst/:id", authCtrl.getGstSlab);
router.put("/gst/:id", authCtrl.updateGstSlab);
router.delete("/gst/:id", authCtrl.deleteGstSlab);

module.exports = router;
