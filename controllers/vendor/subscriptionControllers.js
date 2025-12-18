const { SubscriptionModel, PlanModel, VendorModel } = require("../../models/vendor/subcriptionModel");
const asyncHandler = require("../../utils/asyncHandler");
const { success, error } = require("../../utils/apiResponse");
const subscriptionService = require("../../services/vendor/subscriptionService");

exports.createPlan = asyncHandler(async (req, res) => {
  const { name, priceMonthly, priceYearly, description } = req.body;
  const plan = await PlanModel.create({
    name,
    priceMonthly,
    priceYearly,
    description,
  });
  success(res, plan, "Plan created", 201);
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const plan = await PlanModel.findByPk(req.params.id);
  if (!plan) return error(res, "Plan not found", 404);
  await plan.update(req.body);
  success(res, plan, "Plan updated");
});

exports.listPlans = asyncHandler(async (req, res) => {
  const plans = await PlanModel.findAll();
  success(res, plans);
});

exports.assignSubscription = asyncHandler(async (req, res) => {
  const { vendorId, planId, startDate, endDate } = req.body;
  const vendor = await VendorModel.findByPk(vendorId);
  if (!vendor) return error(res, "Vendor not found", 404);
  const plan = await PlanModel.findByPk(planId);
  if (!plan) return error(res, "Plan not found", 404);
  
  const subscription = await subscriptionService.createSubscription({
    vendorId,
    planId,
    startDate,
    endDate,
  });
  success(res, subscription, "Subscription assigned", 201);
});

exports.editSubscription = asyncHandler(async (req, res) => {
  const sub = await SubscriptionModel.findByPk(req.params.id);
  if (!sub) return error(res, "Subscription not found", 404);
  await sub.update(req.body);
  success(res, sub, "Subscription updated");
});

exports.getSubscriptions = asyncHandler(async (req, res) => {
  const subs = await SubscriptionModel.findAll({ include: ["plan", "vendor"] });
  success(res, subs);
});
