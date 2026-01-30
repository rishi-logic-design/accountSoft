const { BillModel, PaymentModel } = require("../../models");
const { Op } = require("sequelize");

exports.summary = async (customerId) => {
  const totalBills = await BillModel.count({ where: { customerId } });

  const totalPending = await BillModel.sum("pendingAmount", {
    where: { customerId, status: { [Op.in]: ["pending", "partial"] } },
  });

  const totalPaid = await PaymentModel.sum("amount", {
    where: { customerId, type: "credit", status: "completed" },
  });

  return {
    totalBills,
    totalPaid: Number(totalPaid || 0).toFixed(2),
    totalPending: Number(totalPending || 0).toFixed(2),
  };
};
