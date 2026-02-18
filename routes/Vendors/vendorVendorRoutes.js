const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/vendor/vendorVendorController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth, role(["vendor", "admin", "superadmin"]));

router.post("/", ctrl.createVendorVendor);
router.get("/", ctrl.getVendorVendors);
router.get("/:id", ctrl.getVendorVendorById);
router.put("/:id", ctrl.updateVendorVendor);
router.delete("/:id", ctrl.deleteVendorVendor);

module.exports = router;
