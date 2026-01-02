const express = require("express");
const router = express.Router();
const gstSlabController = require("../../controllers/vendor/gstSlabController");
const auth = require("../../middleware/authMiddleware");

router.use(auth);

router.post("/", gstSlabController.createGstSlab);

router.get("/", gstSlabController.listGstSlabs);

router.get("/:id", gstSlabController.getGstSlab);

router.put("/:id", gstSlabController.updateGstSlab);

router.delete("/:id", gstSlabController.deleteGstSlab);

router.patch("/:id/toggle", gstSlabController.toggleGstSlab);

module.exports = router;
