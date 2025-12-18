const express = require("express");
const router = express.Router();
const subCtrl = require("../../controllers/vendor/subscriptionControllers");
const auth = require("../../middleware/authMiddleware");
const role = require("../../middleware/roleMiddleware");

router.use(auth, role(["admin"]));

router.post("/plans", subCtrl.createPlan);
router.get("/plans", subCtrl.listPlans);
router.put("/plans/:id", subCtrl.updatePlan);

router.post("/assign", subCtrl.assignSubscription);
router.get("/", subCtrl.getSubscriptions);
router.put("/:id", subCtrl.editSubscription);

module.exports = router;
