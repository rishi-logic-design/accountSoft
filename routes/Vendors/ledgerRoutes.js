const router = require("express").Router();
const ledgerController = require("../../controllers/vendor/ledgerController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.get("/summary", ledgerController.getLedgerSummary);
router.post("/export", ledgerController.exportLedger);

module.exports = router;
