const express = require("express");
const router = express.Router();
const gstCtrl = require("../../controllers/vendor/vendorGstNumberController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.post("/", gstCtrl.createOrUpdateGstNumber);
router.get("/", gstCtrl.getGstNumber);

module.exports = router;
