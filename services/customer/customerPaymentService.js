const { PaymentModel } = require("../../models");

exports.list = async (customerId) => {
  return PaymentModel.findAll({
    where: { customerId },
    order: [["paymentDate", "DESC"]],
  });
};
