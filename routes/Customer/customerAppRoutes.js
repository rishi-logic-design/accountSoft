const express = require("express");
const router = express.Router();
const customerCtrl = require("../controllers/customerApp.controller");
const customerAuth = require("../middleware/customerAuth.middleware");

router.use(customerAuth);

router.get("/challans", customerCtrl.listChallansForCustomer);
router.get("/challans/:id", customerCtrl.getChallanDetail);

module.exports = router;
