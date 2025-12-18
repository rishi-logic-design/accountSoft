const express = require("express");
const router = express.Router();
const challanCtrl = require("../../controllers/vendor/challanControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(role(["vendor", "admin"]));

router.post("/", challanCtrl.createChallan);
router.get("/", challanCtrl.listChallans);
router.get("/:id", challanCtrl.getChallanById);
router.put("/:id/mark-paid", challanCtrl.markChallanPaid);
router.post("/:id/send-whatsapp", challanCtrl.sendChallanWhatsapp);
router.delete("/:id", challanCtrl.deleteChallan);
router.get("/:id/download", challanCtrl.downloadChallanPdf);

module.exports = router;
