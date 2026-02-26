const router = require("express").Router();
const ledgerController = require("../../controllers/vendor/ledgerController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.get("/customers", ledgerController.getCustomerList);
router.get("/customers/:customerId", ledgerController.getCustomerLedger);

router.get("/vendors", ledgerController.getVendorList);
router.get("/vendors/:sellerId", ledgerController.getVendorLedger);

router.get("/accounts", ledgerController.getAccountList);
router.get("/accounts/:id", ledgerController.getAccountLedger);

// ── LEGACY ROUTES (kept for backward compat) ──────────────────────────────
router.get("/summary", ledgerController.getLedgerSummary);
router.post("/export", ledgerController.exportLedger);

module.exports = router;
