const express = require("express");
const router = express.Router();
const paymentCtrl = require("../../controllers/vendor/paymentControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin","superadmin"]));

router.post("/", paymentCtrl.createPayment);
router.get("/", paymentCtrl.listPayments);
router.get("/:id", paymentCtrl.getPayment);
router.delete("/:id", paymentCtrl.deletePayment);
module.exports = router;
