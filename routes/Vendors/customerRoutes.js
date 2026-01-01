const express = require("express");
const router = express.Router();
const customerCtrl = require("../../controllers/vendor/customerControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

// Customer CRUD
router.post("/", customerCtrl.createCustomer);
router.get("/", customerCtrl.listCustomers);
router.get("/count-by-vendor", customerCtrl.getCustomerCountByVendor);
router.get("/:id", customerCtrl.getCustomerDetail);
router.put("/:id", customerCtrl.updateCustomer);
router.delete("/:id", customerCtrl.deleteCustomer);
router.get("/search", customerCtrl.searchCustomers);

// Transactions
router.post("/:customerId/transactions", customerCtrl.addTransaction);
router.get("/transactions/report", customerCtrl.transactionReport);

module.exports = router;
