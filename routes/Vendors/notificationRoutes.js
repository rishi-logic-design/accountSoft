const express = require("express");
const router = express.Router();
const controller = require("../../controllers/vendor/notificationController");
const auth = require("../../middleware/authMiddleware");
const customerAuth = require("../../middleware/customerAuthMiddleware");

router.get("/", auth, customerAuth, controller.getMyNotifications);
router.put("/:notificationId/read", auth, customerAuth, controller.markAsRead);
router.put("/read-all", auth, customerAuth, controller.markAllRead);

module.exports = router;
 