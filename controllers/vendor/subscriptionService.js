const { SubscriptionModel } = require("../models");

exports.createSubscription = async ({
  vendorId,
  planId,
  startDate,
  endDate,
}) => {
  // additional logic: ensure overlapping subscriptions, calculate status etc.
  const status = new Date(endDate) >= new Date() ? "active" : "expired";
  const sub = await SubscriptionModel.create({
    vendorId,
    planId,
    startDate,
    endDate,
    status,
  });
  return sub;
};

exports.cancelSubscription = async (subscriptionId) => {
  const sub = await SubscriptionModel.findByPk(subscriptionId);
  if (!sub) throw new Error("Not found");
  sub.status = "cancelled";
  await sub.save();
  return sub;
};
