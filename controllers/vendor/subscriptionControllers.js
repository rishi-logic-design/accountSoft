const { SubscriptionModel, PlanModel, VendorModel } = require("../../models");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const subscriptionService = require("../../services/vendor/subscriptionService");
const { Op } = require("sequelize");

exports.createPlan = asyncHandler(async (req, res) => {
  console.log("📦 Creating new plan:", req.body);

  const {
    name,
    priceMonthly,
    priceYearly,
    description,
    duration,
    durationUnit,
    price,
    features,
  } = req.body;

  if (!name || !duration || !price) {
    console.log("❌ Validation Failed: Missing required fields");
    return error(res, "Name, duration, and price are required", 400);
  }

  const parsedDuration = parseInt(duration);
  const parsedUnit = (durationUnit || "month").toLowerCase();

  const allowedPlans = [
    { duration: 1, unit: "month" },
    { duration: 3, unit: "month" },
    { duration: 6, unit: "month" },
    { duration: 9, unit: "month" },
    { duration: 1, unit: "year" },
  ];

  const isValidPlan = allowedPlans.some(
    (plan) => plan.duration === parsedDuration && plan.unit === parsedUnit,
  );

  if (!isValidPlan) {
    return error(
      res,
      "Only 1, 3, 6, 9 month and 1 year plans are allowed",
      400,
    );
  }
  const existingPlan = await PlanModel.findOne({
    where: {
      duration: parsedDuration,
      durationUnit: parsedUnit,
    },
  });

  if (existingPlan) {
    return error(res, "This plan already exists", 409);
  }
  const plan = await PlanModel.create({
    name,
    priceMonthly: priceMonthly || 0,
    priceYearly: priceYearly || 0,
    description,
    duration: parsedDuration,
    durationUnit: parsedUnit,
    price: parseFloat(price),
    features: features || [],
    status: "Active",
  });

  console.log("✅ Plan created successfully:", plan.dataValues);
  success(res, plan, "Plan created successfully", 201);
});

// Update Plan
exports.updatePlan = asyncHandler(async (req, res) => {
  console.log("📝 Updating plan:", req.params.id, req.body);

  const plan = await PlanModel.findByPk(req.params.id);

  if (!plan) {
    console.log("❌ Plan not found");
    return error(res, "Plan not found", 404);
  }

  await plan.update(req.body);

  console.log("✅ Plan updated successfully");
  success(res, plan, "Plan updated successfully");
});

// Delete Plan
exports.deletePlan = asyncHandler(async (req, res) => {
  console.log("🗑️ Deleting plan:", req.params.id);

  const plan = await PlanModel.findByPk(req.params.id);

  if (!plan) {
    console.log("❌ Plan not found");
    return error(res, "Plan not found", 404);
  }

  // Check if plan is assigned to any active subscriptions
  const activeSubscriptions = await SubscriptionModel.count({
    where: {
      planId: req.params.id,
      status: "active",
    },
  });

  if (activeSubscriptions > 0) {
    console.log("❌ Cannot delete plan with active subscriptions");
    return error(
      res,
      `Cannot delete plan. It has ${activeSubscriptions} active subscription(s)`,
      400,
    );
  }

  await plan.destroy();
  console.log("✅ Plan deleted successfully");
  success(res, null, "Plan deleted successfully");
});

// List Plans
exports.listPlans = asyncHandler(async (req, res) => {
  console.log("📋 Fetching all plans");

  const plans = await PlanModel.findAll({
    order: [["createdAt", "DESC"]],
  });

  console.log(`✅ Found ${plans.length} plans`);
  success(res, plans);
});

// Assign Subscription to Vendor
exports.assignSubscription = asyncHandler(async (req, res) => {
  console.log("🎯 Assigning subscription:", req.body);

  const { vendorId, planId } = req.body;

  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) {
    console.log("❌ Vendor not found");
    return error(res, "Vendor not found", 404);
  }

  const plan = await PlanModel.findByPk(planId);
  if (!plan) {
    console.log("❌ Plan not found");
    return error(res, "Plan not found", 404);
  }

  const existingSubscription = await SubscriptionModel.findOne({
    where: {
      vendorId,
      status: "active",
    },
  });

  if (existingSubscription) {
    console.log("❌ Vendor already has an active subscription");
    return error(
      res,
      "Vendor already has an active subscription. Please cancel or expire it first.",
      409,
    );
  }

  const startDate = new Date();
  const endDate = new Date();

  if (plan.durationUnit === "month") {
    endDate.setMonth(endDate.getMonth() + plan.duration);
  } else if (plan.durationUnit === "year") {
    endDate.setFullYear(endDate.getFullYear() + plan.duration);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  console.log(
    `📅 Subscription dates: ${startDate.toISOString().split("T")[0]} to ${
      endDate.toISOString().split("T")[0]
    }`,
  );

  // Create subscription
  const subscription = await subscriptionService.createSubscription({
    vendorId,
    planId,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  });

  // Update vendor expiry date and status
  await vendor.update({
    expiryDate: endDate.toISOString().split("T")[0],
    status: "Active",
  });

  console.log("✅ Subscription assigned successfully");

  // Fetch subscription with relations
  const subscriptionWithRelations = await SubscriptionModel.findByPk(
    subscription.id,
    {
      include: [
        { model: PlanModel, as: "plan" },
        { model: VendorModel, as: "vendor" },
      ],
    },
  );

  success(
    res,
    subscriptionWithRelations,
    "Subscription assigned successfully",
    201,
  );
});

// Edit Subscription
exports.editSubscription = asyncHandler(async (req, res) => {
  console.log("📝 Editing subscription:", req.params.id, req.body);

  const sub = await SubscriptionModel.findByPk(req.params.id);

  if (!sub) {
    console.log("❌ Subscription not found");
    return error(res, "Subscription not found", 404);
  }

  await sub.update(req.body);

  // Update vendor expiry date if endDate is changed
  if (req.body.endDate) {
    await VendorModel.update(
      { expiryDate: req.body.endDate },
      { where: { id: sub.vendorId } },
    );
  }

  console.log("✅ Subscription updated successfully");
  success(res, sub, "Subscription updated successfully");
});

// Get All Subscriptions
exports.getSubscriptions = asyncHandler(async (req, res) => {
  console.log("📋 Fetching subscriptions with filters:", req.query);

  const { page = 1, size = 20, status, vendorId } = req.query;
  const where = {};

  if (status) where.status = status;
  if (vendorId) where.vendorId = vendorId;

  const subs = await SubscriptionModel.findAndCountAll({
    where,
    include: [
      { model: PlanModel, as: "plan" },
      { model: VendorModel, as: "vendor" },
    ],
    limit: parseInt(size, 10),
    offset: (page - 1) * size,
    order: [["createdAt", "DESC"]],
  });

  console.log(`✅ Found ${subs.count} subscriptions`);
  success(res, {
    total: subs.count,
    rows: subs.rows,
    page: parseInt(page),
    totalPages: Math.ceil(subs.count / size),
  });
});

// Get Subscription by ID
exports.getSubscriptionById = asyncHandler(async (req, res) => {
  console.log("🔍 Fetching subscription:", req.params.id);

  const sub = await SubscriptionModel.findByPk(req.params.id, {
    include: [
      { model: PlanModel, as: "plan" },
      { model: VendorModel, as: "vendor" },
    ],
  });

  if (!sub) {
    console.log("❌ Subscription not found");
    return error(res, "Subscription not found", 404);
  }

  console.log("✅ Subscription found");
  success(res, sub);
});

// Cancel Subscription
exports.cancelSubscription = asyncHandler(async (req, res) => {
  console.log("❌ Cancelling subscription:", req.params.id);

  const subscription = await subscriptionService.cancelSubscription(
    req.params.id,
  );

  // Update vendor status to Inactive
  await VendorModel.update(
    { status: "Inactive" },
    { where: { id: subscription.vendorId } },
  );

  console.log("✅ Subscription cancelled successfully");
  success(res, subscription, "Subscription cancelled successfully");
});

// Get Expiring Subscriptions (for alerts)
exports.getExpiringSubscriptions = asyncHandler(async (req, res) => {
  const { days = 7 } = req.query;

  console.log(`⏰ Fetching subscriptions expiring in ${days} days`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + parseInt(days));
  futureDate.setHours(23, 59, 59, 999);

  const expiringSubscriptions = await SubscriptionModel.findAll({
    where: {
      status: "active",
      endDate: {
        [Op.between]: [
          today.toISOString().split("T")[0],
          futureDate.toISOString().split("T")[0],
        ],
      },
    },
    include: [
      { model: PlanModel, as: "plan" },
      { model: VendorModel, as: "vendor" },
    ],
    order: [["endDate", "ASC"]],
  });

  console.log(
    `✅ Found ${expiringSubscriptions.length} expiring subscriptions`,
  );
  success(res, expiringSubscriptions);
});

// Get Expired Subscriptions (expiring today)
exports.getExpiredToday = asyncHandler(async (req, res) => {
  console.log("📅 Fetching subscriptions expiring today");

  const today = new Date().toISOString().split("T")[0];

  const expiredSubscriptions = await SubscriptionModel.findAll({
    where: {
      status: "active",
      endDate: today,
    },
    include: [
      { model: PlanModel, as: "plan" },
      { model: VendorModel, as: "vendor" },
    ],
  });

  console.log(
    `✅ Found ${expiredSubscriptions.length} subscriptions expiring today`,
  );
  success(res, expiredSubscriptions);
});

// Renew Subscription
exports.renewSubscription = asyncHandler(async (req, res) => {
  console.log("🔄 Renewing subscription:", req.params.id);

  const { id } = req.params;
  const { planId } = req.body;

  const subscription = await SubscriptionModel.findByPk(id);

  if (!subscription) {
    console.log("❌ Subscription not found");
    return error(res, "Subscription not found", 404);
  }

  // Get plan (use provided planId or existing planId)
  const plan = await PlanModel.findByPk(planId || subscription.planId);

  if (!plan) {
    console.log("❌ Plan not found");
    return error(res, "Plan not found", 404);
  }

  // Calculate new dates
  const startDate = new Date();
  const endDate = new Date();

  if (plan.durationUnit === "month") {
    endDate.setMonth(endDate.getMonth() + plan.duration);
  } else if (plan.durationUnit === "year") {
    endDate.setFullYear(endDate.getFullYear() + plan.duration);
  } else {
    // Default to 1 month
    endDate.setMonth(endDate.getMonth() + 1);
  }

  console.log(
    `📅 New subscription dates: ${startDate.toISOString().split("T")[0]} to ${
      endDate.toISOString().split("T")[0]
    }`,
  );

  // Update subscription
  await subscription.update({
    planId: planId || subscription.planId,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    status: "active",
  });

  // Update vendor
  await VendorModel.update(
    {
      expiryDate: endDate.toISOString().split("T")[0],
      status: "Active",
    },
    { where: { id: subscription.vendorId } },
  );

  console.log("✅ Subscription renewed successfully");

  // Fetch updated subscription with relations
  const renewedSubscription = await SubscriptionModel.findByPk(
    subscription.id,
    {
      include: [
        { model: PlanModel, as: "plan" },
        { model: VendorModel, as: "vendor" },
      ],
    },
  );

  success(res, renewedSubscription, "Subscription renewed successfully");
});

// Get Subscription Stats
exports.getSubscriptionStats = asyncHandler(async (req, res) => {
  console.log("📊 Fetching subscription statistics");

  const activeCount = await SubscriptionModel.count({
    where: { status: "active" },
  });

  const expiredCount = await SubscriptionModel.count({
    where: { status: "expired" },
  });

  const cancelledCount = await SubscriptionModel.count({
    where: { status: "cancelled" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next7Days = new Date();
  next7Days.setDate(next7Days.getDate() + 7);
  next7Days.setHours(23, 59, 59, 999);

  const expiringCount = await SubscriptionModel.count({
    where: {
      status: "active",
      endDate: {
        [Op.between]: [
          today.toISOString().split("T")[0],
          next7Days.toISOString().split("T")[0],
        ],
      },
    },
  });

  const stats = {
    active: activeCount,
    expired: expiredCount,
    cancelled: cancelledCount,
    expiringSoon: expiringCount,
  };

  console.log("✅ Stats:", stats);
  success(res, stats);
});
