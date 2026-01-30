const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerChallanController");

router.get("/", auth, controller.getMyChallans);
router.get("/:id", auth, controller.getMyChallan);

module.exports = router;
