// routes/bill.routes.js
const express = require("express");
const router = express.Router();
const billCtrl = require("../../controllers/vendor/billController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin"]));

router.post("/", billCtrl.createBill);
router.get("/", billCtrl.listBills);
router.get("/:id", billCtrl.getBill);
router.put("/:id/mark-paid", billCtrl.markBillPaid);
router.put("/:id", billCtrl.editBill);
router.get("/:id/download", billCtrl.generateBillPdf);
router.post("/:id/send-whatsapp", billCtrl.sendBillWhatsapp);
router.delete("/:id", billCtrl.deleteBill);

module.exports = router;
