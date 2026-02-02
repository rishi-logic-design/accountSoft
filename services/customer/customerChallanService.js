const { Op } = require("sequelize");
const { ChallanModel, ChallanItemModel, VendorModel } = require("../../models");

exports.list = async (customerId, filters = {}) => {
  const { page = 1, size = 20, search, status, fromDate, toDate } = filters;

  const where = {
    customerId: Number(customerId),
  };

  if (status) where.status = status;

  if (search) {
    where[Op.or] = [{ challanNumber: { [Op.like]: `%${search}%` } }];
  }

  if (fromDate || toDate) {
    where.challanDate = {};
    if (fromDate) where.challanDate[Op.gte] = fromDate;
    if (toDate) where.challanDate[Op.lte] = toDate;
  }

  const result = await ChallanModel.findAndCountAll({
    where,
    distinct: true,
    include: [
      {
        model: VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName"],
      },
      {
        model: ChallanItemModel,
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

exports.getById = async (id, customerId) => {
  return ChallanModel.findOne({
    where: { id, customerId },
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
        model: ChallanItemModel,
        as: "items",
      },
    ],
  });
};
