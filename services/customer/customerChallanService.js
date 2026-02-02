const { Op } = require("sequelize");
const { ChallanModel, ChallanItemModel, VendorModel } = require("../../models");

exports.list = async (customerId, filters) => {
  const where = { customerId };

  if (filters.status) where.status = filters.status;

  if (filters.search) {
    where[Op.or] = [{ challanNumber: { [Op.like]: `%${filters.search}%` } }];
  }

  if (filters.fromDate && filters.toDate) {
    where.challanDate = {
      [Op.between]: [filters.fromDate, filters.toDate],
    };
  }

  return ChallanModel.findAndCountAll({
    where,
    include: [
      {
        model: VendorModel,
        as: "vendor",
        attributes: ["id", "vendorName", "businessName"],
      },
    ],
    limit: +filters.size,
    offset: (filters.page - 1) * filters.size,
    order: [["createdAt", "DESC"]],
  });
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
