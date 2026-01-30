const { ChallanModel, ChallanItemModel } = require("../../models");

exports.list = async (customerId) => {
  return ChallanModel.findAll({
    where: { customerId },
    include: [{ model: ChallanItemModel, as: "items" }],
    order: [["challanDate", "DESC"]],
  });
};

exports.getById = async (id, customerId) => {
  const challan = await ChallanModel.findOne({
    where: { id, customerId },
    include: [{ model: ChallanItemModel, as: "items" }],
  });
  if (!challan) throw new Error("Challan not found");
  return challan;
};
