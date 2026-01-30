const { BillModel, BillItemModel } = require("../../models");

exports.list = async (customerId) => {
  return BillModel.findAll({
    where: { customerId },
    include: [{ model: BillItemModel, as: "items" }],
    order: [["billDate", "DESC"]],
  });
};

exports.getById = async (billId, customerId) => {
  const bill = await BillModel.findOne({
    where: { id: billId, customerId },
    include: [{ model: BillItemModel, as: "items" }],
  });
  if (!bill) throw new Error("Bill not found");
  return bill;
};
