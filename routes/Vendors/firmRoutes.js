const express = require("express");
const router = express.Router();
const firmController = require("../../controllers/vendor/firmController");
const auth = require("../../middleware/authMiddleware");

router.use(auth);

router.post("/", firmController.upsertFirm);

router.get("/", firmController.getFirm);

router.put("/", firmController.updateFirm);

router.delete("/", firmController.deleteFirm);

module.exports = router;
