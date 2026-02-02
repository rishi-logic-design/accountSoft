const { Op } = require("sequelize");
const { BillModel, BillItemModel, VendorModel } = require("../../models");

exports.list = async (customerId, filters = {}) => {
  const { page = 1, size = 20, search, status, fromDate, toDate } = filters;

  const where = {
    customerId: Number(customerId),
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [{ billNumber: { [Op.like]: `%${search}%` } }];
  }

  if (fromDate || toDate) {
    where.billDate = {};
    if (fromDate) where.billDate[Op.gte] = fromDate;
    if (toDate) where.billDate[Op.lte] = toDate;
  }

  const result = await BillModel.findAndCountAll({
    where,
    distinct: true,
    include: [
      {
        model: VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName"],
      },
      {
        model: BillItemModel,
        as: "items",
      },
    ],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["createdAt", "DESC"]],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
  };
};
exports.getById = async (billId, customerId) => {
  return BillModel.findOne({
    where: { id: billId, customerId },
    include: [
      {
        model: VendorModel,
        as: "vendor",
        attributes: [
          "id",
          "vendorName",
          "businessName",
          "gst",
          "mobile",
          "address",
        ],
      },
      {
        model: BillItemModel,
        as: "items",
      },
    ],
  });
};
