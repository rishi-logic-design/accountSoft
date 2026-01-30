const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const controller = require("../../controllers/customer/customerBillController");

router.get("/", auth, controller.getMyBills);
router.get("/:id", auth, controller.getMyBill);

module.exports = router;
