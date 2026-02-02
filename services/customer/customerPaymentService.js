const { PaymentModel } = require("../../models");
const { Op } = require("sequelize");

exports.list = async (customerId, filters = {}) => {
  const { page = 1, size = 20, method, status, fromDate, toDate } = filters;

  const where = {
    customerId: Number(customerId),
  };

  if (method) {
    where.method = method;
  }

  if (status) {
    where.type = status;
  }

  if (fromDate || toDate) {
    where.paymentDate = {};
    if (fromDate) where.paymentDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      where.paymentDate[Op.lte] = end;
    }
  }

  const result = await PaymentModel.findAndCountAll({
    where,
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["paymentDate", "DESC"]],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
  };
};
