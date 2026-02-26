const express = require("express");
const router = express.Router();
const salesDebitNoteCtrl = require("../../controllers/vendor/salesDebitNoteController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.post("/", salesDebitNoteCtrl.createSalesDebitNote);
router.get("/", salesDebitNoteCtrl.listSalesDebitNotes);
router.get("/:id", salesDebitNoteCtrl.getSalesDebitNoteById);
router.put("/:id", salesDebitNoteCtrl.updateSalesDebitNote);
router.delete("/:id", salesDebitNoteCtrl.deleteSalesDebitNote);
router.post("/record-payment", salesDebitNoteCtrl.recordPayment);

module.exports = router;
