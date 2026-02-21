const express = require("express");
const router = express.Router();
const vendorBillController = require("../../controllers/vendor/vendorBillController");
const authenticate = require("../../middleware/authMiddleware");

router.use(authenticate);

router.post("/", vendorBillController.createBill);
router.get("/", vendorBillController.listBills);
router.get("/:id", vendorBillController.getBillById);
router.delete("/:id", vendorBillController.deleteBill);

module.exports = router;
