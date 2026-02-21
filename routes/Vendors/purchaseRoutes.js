const express = require("express");
const router = express.Router();
const purchaseController = require("../../controllers/vendor/purchaseController");
const auth = require("../../middleware/authMiddleware");

router.use(auth);

router.post("/", purchaseController.createPurchase);
router.get("/", purchaseController.listPurchases);
router.get("/:id", purchaseController.getPurchaseById);
router.delete("/:id", purchaseController.deletePurchase);
router.patch("/:id/status", purchaseController.updateStatus);

module.exports = router;
