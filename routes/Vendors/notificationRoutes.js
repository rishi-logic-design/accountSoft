const express = require("express");
const router = express.Router();
const controller = require("../../controllers/vendor/notificationController");
const auth = require("../../middleware/authMiddleware");

router.get("/", auth, controller.getMyNotifications);
router.put("/:notificationId/read", auth, controller.markAsRead);
router.put("/read-all", auth, controller.markAllRead);

module.exports = router;
 