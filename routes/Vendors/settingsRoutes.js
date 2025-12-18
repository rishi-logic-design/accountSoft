const express = require("express");
const router = express.Router();
const settingsCtrl = require("../../controllers/vendor/authControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin"]));

/* Firm */
router.get("/firm", settingsCtrl.getFirm);
router.post("/firm", settingsCtrl.upsertFirm);

/* GST slabs */
router.post("/gst", settingsCtrl.createGstSlab);
router.get("/gst", settingsCtrl.listGstSlabs);
router.get("/gst/:id", settingsCtrl.getGstSlab);
router.put("/gst/:id", settingsCtrl.updateGstSlab);
router.delete("/gst/:id", settingsCtrl.deleteGstSlab);

module.exports = router;
