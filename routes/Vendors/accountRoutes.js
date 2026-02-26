const express = require("express");
const router = express.Router();
const accountController = require("../../controllers/vendor/accountController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.get("/", accountController.getAccounts);
router.post("/", accountController.createAccount);
router.put("/:id", accountController.updateAccount);
router.delete("/:id", accountController.deleteAccount);

router.post("/adjust-balance", accountController.adjustBalance);
router.post("/contra-entry", accountController.contraEntry);
router.get("/:id/ledger", accountController.getAccountLedger);

module.exports = router;
