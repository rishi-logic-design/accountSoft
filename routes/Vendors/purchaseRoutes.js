const express = require("express");
const router = express.Router();
const purchaseController = require("../../controllers/vendor/purchaseController");
const { authenticateVendor } = require("../../middlewares/authMiddleware");

router.use(authenticateVendor);

router.post("/create", purchaseController.createPurchase);
router.get("/list", purchaseController.listPurchases);
router.get("/:id", purchaseController.getPurchaseById);
router.delete("/:id", purchaseController.deletePurchase);

module.exports = router;
