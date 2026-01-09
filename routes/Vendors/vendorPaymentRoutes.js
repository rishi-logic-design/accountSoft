const express = require("express");
const router = express.Router();
const paymentCtrl = require("../../controllers/vendor/vendorPaymentControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");
const upload = require("../../middleware/upload");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.post(
  "/vendor-payments",
  auth,
  upload.single("qrCodeAttachment"),
  paymentCtrl.createOrUpdatePaymentDetails
);
router.get("/", paymentCtrl.getPaymentDetails);

module.exports = router;
