const express = require("express");
const router = express.Router();
const subCtrl = require("../../controllers/vendor/subscriptionControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth, role(["admin", "superadmin"]));

router.post("/plans", subCtrl.createPlan);
router.get("/plans", subCtrl.listPlans);
router.put("/plans/:id", subCtrl.updatePlan);
router.delete("/plans/:id", subCtrl.deletePlan);

router.post("/assign", subCtrl.assignSubscription);
router.get("/stats", subCtrl.getSubscriptionStats);
router.get("/expiring", subCtrl.getExpiringSubscriptions);
router.get("/expired-today", subCtrl.getExpiredToday);
router.get("/", subCtrl.getSubscriptions);
router.get("/:id", subCtrl.getSubscriptionById);
router.put("/:id", subCtrl.editSubscription);
router.post("/:id/cancel", subCtrl.cancelSubscription);
router.post("/:id/renew", subCtrl.renewSubscription);

module.exports = router;
