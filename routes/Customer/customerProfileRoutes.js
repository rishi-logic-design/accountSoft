const express = require("express");
const router = express.Router();
const auth = require("../../middleware/customerAuthMiddleware");
const controller = require("../../controllers/customer/customerProfileController");

router.get("/", auth, controller.getMyProfile);
router.put("/", auth, controller.updateMyProfile);

module.exports = router;
