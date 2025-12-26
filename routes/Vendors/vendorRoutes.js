const express = require("express");
const router = express.Router();
const vendorCtrl = require("../../controllers/vendor/vendorControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth, role(["admin","superadmin"]));



router.post("/", vendorCtrl.createVendor);
router.get("/", vendorCtrl.getVendors);
router.get("/:id", vendorCtrl.getVendorById);
router.put("/:id", vendorCtrl.updateVendor);
router.delete("/:id", vendorCtrl.deleteVendor);

module.exports = router;
