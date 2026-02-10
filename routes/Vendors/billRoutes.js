const express = require("express");
const router = express.Router();
const billCtrl = require("../../controllers/vendor/billController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin", "customer"]));

router.get("/templates", billCtrl.getTemplates);

router.post("/", billCtrl.createBill);
router.get("/", billCtrl.listBills);
router.get("/pending-total", billCtrl.getVendorPendingBillTotal);
router.get("/:id/download", billCtrl.generateBillPdf);
router.get("/:id", billCtrl.getBill);
router.put("/:id/mark-paid", billCtrl.markBillPaid);
router.put("/:id/template", billCtrl.updateBillTemplate);
router.put("/:id", billCtrl.editBill);
router.post("/:id/send-whatsapp", billCtrl.sendBillWhatsapp);
router.delete("/:id", billCtrl.deleteBill);

module.exports = router;
