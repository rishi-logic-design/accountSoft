const express = require("express");
const router = express.Router();
const trxCtrl = require("../../controllers/customer/transactionController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin"]));

router.get("/", trxCtrl.listTransactions);
router.get("/export", trxCtrl.exportCsv);
router.get("/:id", trxCtrl.getTransaction);

module.exports = router;
