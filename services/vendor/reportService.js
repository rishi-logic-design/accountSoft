const {
  BillModel,
  BillItemModel,
  CustomerModel,
  sequelize,
} = require("../../models");
const { Op, fn, col, literal } = require("sequelize");

function toNum(v) {
  return parseFloat(v || 0);
}

exports.getProductWiseSalesReport = async (
  vendorId,
  { fromDate, toDate, search, page = 1, size = 10 } = {},
) => {
  const billWhere = { vendorId, status: { [Op.ne]: "cancelled" } };

  if (fromDate || toDate) {
    billWhere.billDate = {};
    if (fromDate) billWhere.billDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      billWhere.billDate[Op.lte] = end;
    }
  }

  const bills = await BillModel.findAll({
    where: billWhere,
    attributes: ["id"],
    raw: true,
  });

  const billIds = bills.map((b) => b.id);

  if (billIds.length === 0) {
    return {
      rows: [],
      total: 0,
      page: Number(page),
      size: Number(size),
      totalPages: 0,
      grandTotalAmount: 0,
      grandTotalQty: 0,
    };
  }

  const itemWhere = { billId: { [Op.in]: billIds } };
  if (search) {
    itemWhere.itemName = { [Op.like]: `%${search}%` };
  }

  const grouped = await BillItemModel.findAll({
    where: itemWhere,
    attributes: [
      "itemName",
      [fn("SUM", col("qty")), "totalQty"],
      [fn("SUM", col("totalWithGst")), "totalAmount"],
      [fn("COUNT", col("id")), "orderCount"],
    ],
    group: ["itemName"],
    order: [[literal("totalAmount"), "DESC"]],
    raw: true,
  });

  const total = grouped.length;
  const paged = grouped.slice(
    (Number(page) - 1) * Number(size),
    Number(page) * Number(size),
  );

  const grandTotalAmount = grouped.reduce(
    (s, r) => s + toNum(r.totalAmount),
    0,
  );
  const grandTotalQty = grouped.reduce((s, r) => s + toNum(r.totalQty), 0);

  return {
    rows: paged.map((r, i) => ({
      serialNo: (Number(page) - 1) * Number(size) + i + 1,
      productName: r.itemName,
      totalQty: toNum(r.totalQty),
      totalAmount: +toNum(r.totalAmount).toFixed(2),
      orderCount: Number(r.orderCount),
    })),
    total,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(total / Number(size)),
    grandTotalAmount: +grandTotalAmount.toFixed(2),
    grandTotalQty: +grandTotalQty.toFixed(2),
  };
};
