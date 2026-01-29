const express = require("express");
const router = express.Router();
const paymentController = require("../../controllers/vendor/paymentControllers");
const authenticate = require("../../middleware/authMiddleware");
router.use(authenticate);

router.post("/", paymentController.createPayment);

router.get("/", paymentController.listPayments);
router.get("/stats", paymentController.getPaymentStats);
router.get(
  "/customer/:customerId/outstanding",
  paymentController.getCustomerOutstanding,
);
router.get(
  "/customer/:customerId/invoices",
  paymentController.getCustomerPendingInvoices,
);
router.get("/:id", paymentController.getPaymentById);
router.put("/:id", paymentController.updatePayment);
router.delete("/:id", paymentController.deletePayment);

module.exports = router;
