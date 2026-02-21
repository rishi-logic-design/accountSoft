const express = require("express");
const router = express.Router();
const purchaseBillController = require("../../controllers/vendor/purchaseBillController");
const authenticate = require("../../middleware/authMiddleware");

router.use(authenticate);

router.post("/", purchaseBillController.createBill);
router.get("/", purchaseBillController.listBills);
router.get("/:id", purchaseBillController.getBillById);
router.delete("/:id", purchaseBillController.deleteBill);

module.exports = router;
