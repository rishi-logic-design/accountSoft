const { VendorModel, SubscriptionModel, PlanModel } = require("../../models/index");
const asyncHandler = require("../../utils/asyncHandler");
const { success } = require("../../utils/apiResponse");
const { Sequelize } = require("sequelize");

exports.getDashboard = asyncHandler(async (req, res) => {
  const totalVendors = await VendorModel.count();
  const totalRevenue = await SubscriptionModel.findAll({
    where: { status: "active" },
    include: [
      {
        model: PlanModel,
        as: "plan",
        attributes: ["priceMonthly", "priceYearly"],
      },
    ],
  });

  let revenueMonthly = 0;
  totalRevenue.forEach((s) => {
    if (s.plan) revenueMonthly += parseFloat(s.plan.priceMonthly || 0);
  });

  const subsPerMonth = await SubscriptionModel.findAll({
    attributes: [
      [Sequelize.fn("MONTH", Sequelize.col("startDate")), "month"],
      [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
    ],
    group: ["month"],
    raw: true,
  });

  success(res, {
    totalVendors,
    revenueMonthly,
    subsPerMonth,
  });
});
