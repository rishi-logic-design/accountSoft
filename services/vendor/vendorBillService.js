const {
  VendorBillModel,
  VendorVendorModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.createBill = async (vendorId, payload) => {
  const { billNumber, billDate, amount, sellerId, billImage, note } = payload;

  if (!billNumber) throw new Error("Invoice Number is required");
  if (!billDate) throw new Error("Bill Date is required");
  if (!amount || toNumber(amount) <= 0)
    throw new Error("Valid amount is required");
  if (!sellerId) throw new Error("Seller is required");

  const billAmount = toNumber(amount);

  return await VendorBillModel.create({
    billNumber,
    billDate,
    amount: billAmount.toFixed(2),
    paidAmount: "0.00",
    pendingAmount: billAmount.toFixed(2),
    vendorId,
    sellerId,
    billImage: billImage || null,
    note: note || null,
    status: "unpaid",
  });
};

exports.listBills = async ({
  vendorId,
  sellerId,
  page = 1,
  size = 20,
  search,
  status,
  fromDate,
  toDate,
} = {}) => {
  const where = { vendorId };

  if (sellerId) where.sellerId = sellerId;
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.billDate = {};
    if (fromDate) where.billDate[Op.gte] = fromDate;
    if (toDate) where.billDate[Op.lte] = toDate;
  }

  if (search) {
    where[Op.or] = [
      { billNumber: { [Op.like]: `%${search}%` } },
      { note: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await VendorBillModel.findAndCountAll({
    where,
    include: [{ model: VendorVendorModel, as: "seller" }],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [
      ["billDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};

exports.getBillById = async (id, vendorId) => {
  const bill = await VendorBillModel.findOne({
    where: { id, vendorId },
    include: [{ model: VendorVendorModel, as: "seller" }],
  });

  if (!bill) throw new Error("Vendor bill not found");
  return bill;
};

exports.deleteBill = async (id, vendorId) => {
  const bill = await VendorBillModel.findOne({
    where: { id, vendorId },
  });

  if (!bill) throw new Error("Vendor bill not found");
  await bill.destroy();
  return true;
};
