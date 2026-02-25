const express = require("express");
const router = express.Router();
const creditNoteCtrl = require("../../controllers/vendor/creditNoteController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.post("/", creditNoteCtrl.createCreditNote);
router.get("/", creditNoteCtrl.listCreditNotes);
router.get("/:id", creditNoteCtrl.getCreditNoteById);
router.put("/:id", creditNoteCtrl.updateCreditNote);
router.delete("/:id", creditNoteCtrl.deleteCreditNote);

module.exports = router;
