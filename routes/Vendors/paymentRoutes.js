const express = require("express");
const router = express.Router();
const paymentCtrl = require("../../controllers/vendor/paymentControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.post("/", paymentCtrl.createPayment);

router.get("/", paymentCtrl.listPayments);

router.get("/stats", paymentCtrl.getPaymentStats);

router.get(
  "/customer/:customerId/outstanding",
  paymentCtrl.getCustomerOutstanding
);

router.get(
  "/customer/:customerId/invoices",
  paymentCtrl.getCustomerPendingInvoices
);

router.get("/:id", paymentCtrl.getPaymentById);

router.put("/:id", paymentCtrl.updatePayment);

router.delete("/:id", paymentCtrl.deletePayment);

module.exports = router;
