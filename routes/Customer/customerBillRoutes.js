const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerBillController");

router.get("/", auth, controller.getMyBills);
router.get("/:id", auth, controller.getMyBill);
router.get("/download/pdf/:billId", auth, controller.downloadBillByPdf);
module.exports = router;
