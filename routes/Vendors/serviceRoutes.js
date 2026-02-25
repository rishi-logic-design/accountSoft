const express = require("express");
const router = express.Router();
const serviceCtrl = require("../../controllers/vendor/serviceController");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin", "superadmin"]));

router.post("/", serviceCtrl.createService);
router.get("/", serviceCtrl.listServices);
router.get("/:id", serviceCtrl.getServiceById);
router.put("/:id", serviceCtrl.updateService);
router.delete("/:id", serviceCtrl.deleteService);

module.exports = router;
