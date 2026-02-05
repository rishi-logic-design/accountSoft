const express = require("express");
const router = express.Router();
const controller = require("../../controllers/vendor/notificationController");
const auth = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");

router.use(auth);
router.use(roleMiddleware(["vendor", "admin", "superadmin", "customer"]));

router.get("/", controller.getMyNotifications);
router.put("/:notificationId/read", controller.markAsRead);
router.put("/read-all", controller.markAllRead);

module.exports = router;
