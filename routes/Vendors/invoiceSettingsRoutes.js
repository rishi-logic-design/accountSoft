const express = require("express");
const router = express.Router();
const invoiceSettingsCtrl = require("../../controllers/vendor/invoiceSettingsController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.get("/", invoiceSettingsCtrl.getInvoiceSettings);

router.put("/", invoiceSettingsCtrl.updateInvoiceSettings);

router.get("/next-number", invoiceSettingsCtrl.getNextInvoiceNumber);

router.get("/check-number", invoiceSettingsCtrl.checkInvoiceNumber);

router.get("/template-preview", invoiceSettingsCtrl.getTemplatePreview);

module.exports = router;
