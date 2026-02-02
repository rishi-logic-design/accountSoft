const { Op } = require("sequelize");
const { BillModel, BillItemModel, VendorModel } = require("../../models");

exports.list = async (customerId, filters) => {
  const where = { customerId };

  if (filters.status) where.status = filters.status;

  if (filters.search) {
    where[Op.or] = [{ billNumber: { [Op.like]: `%${filters.search}%` } }];
  }

  if (filters.fromDate && filters.toDate) {
    where.billDate = {
      [Op.between]: [filters.fromDate, filters.toDate],
    };
  }

  return BillModel.findAndCountAll({
    where,
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
    limit: +filters.size,
    offset: (filters.page - 1) * filters.size,
    order: [["createdAt", "DESC"]],
  });
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
