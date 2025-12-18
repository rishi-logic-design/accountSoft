const {
  BillModel,
  TransactionModel,
  ChallanModel,
  ChallanItemModel,
  ProductModel,
  sequelize,
} = require("../../models/index");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.getVendorSummary = async (
  vendorId,
  { fromDate = null, toDate = null } = {}
) => {
  // 1) Calculate total bills sum for vendor (optionally date filtered)
  const billWhere = { vendorId };
  if (fromDate)
    billWhere.billDate = { ...(billWhere.billDate || {}), [Op.gte]: fromDate };
  if (toDate)
    billWhere.billDate = { ...(billWhere.billDate || {}), [Op.lte]: toDate };

  const totalBillsRow = await BillModel.findOne({
    where: billWhere,
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn("SUM", sequelize.col("totalWithGST")),
          0
        ),
        "totalBills",
      ],
    ],
    raw: true,
  });
  const totalBills = toNumber(totalBillsRow.totalBills);

  // 2) Sum of payments that are linked to bills (billId not null) for same vendor and optional date filter
  const paymentWhere = { vendorId, billId: { [Op.ne]: null } };
  if (fromDate)
    paymentWhere.transactionDate = {
      ...(paymentWhere.transactionDate || {}),
      [Op.gte]: fromDate,
    };
  if (toDate)
    paymentWhere.transactionDate = {
      ...(paymentWhere.transactionDate || {}),
      [Op.lte]: toDate,
    };

  const totalPaymentsRow = await TransactionModel.findOne({
    where: paymentWhere,
    attributes: [
      [
        sequelize.fn(
          "COALESCE",
          sequelize.fn("SUM", sequelize.col("amount")),
          0
        ),
        "totalPayments",
      ],
    ],
    raw: true,
  });
  const totalPayments = toNumber(totalPaymentsRow.totalPayments);

  const totalPending = +(totalBills - totalPayments).toFixed(2);

  const challanWhere = { vendorId };
  if (fromDate)
    challanWhere.challanDate = {
      ...(challanWhere.challanDate || {}),
      [Op.gte]: fromDate,
    };
  if (toDate)
    challanWhere.challanDate = {
      ...(challanWhere.challanDate || {}),
      [Op.lte]: toDate,
    };

  const purchases = await ChallanItemModel.findAll({
    attributes: [
      [
        sequelize.fn("COALESCE", sequelize.col("ChallanItem.productId"), null),
        "productId",
      ],
      [
        sequelize.fn("COALESCE", sequelize.col("ChallanItem.productName"), ""),
        "productName",
      ],
      [sequelize.fn("SUM", sequelize.col("ChallanItem.qty")), "totalQty"],
      [sequelize.fn("SUM", sequelize.col("ChallanItem.amount")), "totalAmount"],
    ],
    include: [
      {
        model: ChallanModel,
        as: "challan",
        attributes: [],
        where: challanWhere,
      },
    ],
    group: ["ChallanItem.productId", "ChallanItem.productName"],
    order: [[sequelize.fn("SUM", sequelize.col("ChallanItem.qty")), "DESC"]],
    raw: true,
  });

  // Normalize result numbers
  const purchasesByProduct = purchases.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    totalQty: +parseFloat(r.totalQty || 0),
    totalAmount: +(+r.totalAmount || 0).toFixed(2),
  }));

  return {
    totalBills: +totalBills.toFixed(2),
    totalPayments: +totalPayments.toFixed(2),
    totalPending,
    purchasesByProduct,
  };
};
