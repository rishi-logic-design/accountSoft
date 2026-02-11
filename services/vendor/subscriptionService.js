const {
  SubscriptionModel,
  VendorModel,
  PlanModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function calculateStatus(endDate) {
  if (!endDate) return "expired";
  const today = new Date();
  const e = new Date(endDate);
  return e >= new Date(today.toISOString().split("T")[0])
    ? "active"
    : "expired";
}

exports.createSubscription = async (
  { vendorId, planId, startDate, endDate },
  options = {}
) => {
  if (!vendorId || !planId || !startDate || !endDate) {
    throw new Error("vendorId, planId, startDate and endDate are required");
  }

  return await sequelize.transaction(async (t) => {
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");

    const plan = await PlanModel.findByPk(planId, { transaction: t });
    if (!plan) throw new Error("Plan not found");

    const overlapping = await SubscriptionModel.findOne({
      where: {
        vendorId,
        status: "active",
        [Op.or]: [
          {
            startDate: { [Op.between]: [startDate, endDate] },
          },
          {
            endDate: { [Op.between]: [startDate, endDate] },
          },
          {
            startDate: { [Op.lte]: startDate },
            endDate: { [Op.gte]: endDate },
          },
        ],
      },
      transaction: t,
    });

    if (overlapping && !options.forceReplace) {
      throw new Error(
        "Vendor already has an overlapping active subscription. Use forceReplace to override."
      );
    }

    if (overlapping && options.forceReplace) {
      overlapping.status = "cancelled";
      await overlapping.save({ transaction: t });
    }

    const status = calculateStatus(endDate);

    const subscription = await SubscriptionModel.create(
      {
        vendorId,
        planId,
        startDate,
        endDate,
        status,
      },
      { transaction: t }
    );

    await vendor.update(
      {
        subscriptionDate: startDate,
        expiryDate: endDate,
      },
      { transaction: t }
    );

    return subscription;
  });
};

exports.getSubscriptions = async (filters = {}) => {
  const where = {};
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.planId) where.planId = filters.planId;
  if (filters.status) where.status = filters.status;

  const subs = await SubscriptionModel.findAll({
    where,
    include: [
      { model: VendorModel, as: "vendor" },
      { model: PlanModel, as: "plan" },
    ],
    order: [["createdAt", "DESC"]],
  });

  return subs;
};

exports.getSubscriptionById = async (id) => {
  const sub = await SubscriptionModel.findByPk(id, {
    include: [
      { model: VendorModel, as: "vendor" },
      { model: PlanModel, as: "plan" },
    ],
  });
  if (!sub) throw new Error("Subscription not found");
  return sub;
};

exports.updateSubscription = async (id, data) => {
  return await sequelize.transaction(async (t) => {
    const sub = await SubscriptionModel.findByPk(id, { transaction: t });
    if (!sub) throw new Error("Subscription not found");

    await sub.update(data, { transaction: t });

    if (data.endDate) {
      sub.status = calculateStatus(data.endDate);
      await sub.save({ transaction: t });
      const vendor = await VendorModel.findByPk(sub.vendorId, {
        transaction: t,
      });
      if (vendor) {
        await vendor.update({ expiryDate: data.endDate }, { transaction: t });
      }
    }

    return sub;
  });
};

exports.cancelSubscription = async (id) => {
  return await sequelize.transaction(async (t) => {
    const sub = await SubscriptionModel.findByPk(id, { transaction: t });
    if (!sub) throw new Error("Subscription not found");

    sub.status = "cancelled";
    await sub.save({ transaction: t });

    const vendor = await VendorModel.findByPk(sub.vendorId, { transaction: t });
    if (vendor) {
      if (
        vendor.expiryDate &&
        sub.endDate &&
        new Date(vendor.expiryDate).getTime() ===
          new Date(sub.endDate).getTime()
      ) {
        await vendor.update({ expiryDate: null }, { transaction: t });
      }
    }

    return sub;
  });
};

exports.renewSubscription = async (id, { extendMonths, newEndDate } = {}) => {
  if (!extendMonths && !newEndDate)
    throw new Error("extendMonths or newEndDate required");

  return await sequelize.transaction(async (t) => {
    const sub = await SubscriptionModel.findByPk(id, { transaction: t });
    if (!sub) throw new Error("Subscription not found");

    let end = sub.endDate ? new Date(sub.endDate) : new Date();
    if (newEndDate) {
      end = new Date(newEndDate);
    } else {
      end.setMonth(end.getMonth() + extendMonths);
    }

    const endIso = end.toISOString().split("T")[0];

    sub.endDate = endIso;
    sub.status = calculateStatus(endIso);
    await sub.save({ transaction: t });

    const vendor = await VendorModel.findByPk(sub.vendorId, { transaction: t });
    if (vendor) {
      await vendor.update({ expiryDate: endIso }, { transaction: t });
    }

    return sub;
  });
};

exports.expireDueSubscriptions = async () => {
  const todayIso = new Date().toISOString().split("T")[0];
  const [updatedCount] = await SubscriptionModel.update(
    { status: "expired" },
    {
      where: {
        endDate: { [Op.lt]: todayIso },
        status: { [Op.ne]: "expired" },
      },
    }
  );

  return updatedCount;
};

exports.assignPlanToVendor = async (
  vendorId,
  planId,
  startDate,
  endDate,
  options = {}
) => {
  return await this.createSubscription(
    { vendorId, planId, startDate, endDate },
    options
  );
};
