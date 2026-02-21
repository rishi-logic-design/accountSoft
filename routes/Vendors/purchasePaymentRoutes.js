const express = require("express");
const router = express.Router();
const purchasePaymentController = require("../../controllers/vendor/purchasePaymentController");
const authenticate = require("../../middleware/authMiddleware");

router.use(authenticate);

router.post("/", purchasePaymentController.createPayment);
router.get("/", purchasePaymentController.listPayments);
router.get("/:id", purchasePaymentController.getPaymentById);
router.delete("/:id", purchasePaymentController.deletePayment);

router.get(
  "/seller/:sellerId/outstanding",
  purchasePaymentController.getSellerOutstanding,
);
router.get(
  "/seller/:sellerId/purchases",
  purchasePaymentController.getSellerPendingPurchases,
);

module.exports = router;
