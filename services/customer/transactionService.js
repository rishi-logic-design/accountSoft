const {
  TransactionModel,
  CustomerModel,
  BillModel,
  ChallanModel,
} = require("../../models/index");
const { Op } = require("sequelize");

exports.listTransactions = async (filters = {}) => {
  const {
    vendorId,
    page = 1,
    size = 20,
    type,
    customerId,
    billId,
    challanId,
    fromDate,
    toDate,
    search,
    sortBy = "transactionDate",
    sortDir = "DESC",
  } = filters;

  const where = {};
  if (vendorId) where.vendorId = vendorId;
  if (type) where.type = type;
  if (customerId) where.customerId = customerId;
  if (billId) where.billId = billId;
  if (challanId) where.challanId = challanId;
  if (fromDate)
    where.transactionDate = {
      ...(where.transactionDate || {}),
      [Op.gte]: fromDate,
    };
  if (toDate)
    where.transactionDate = {
      ...(where.transactionDate || {}),
      [Op.lte]: toDate,
    };

  if (search) {
    // search in description or amount or id
    where[Op.or] = [
      { description: { [Op.like]: `%${search}%` } },
      { "$TransactionModel.id$": isNaN(Number(search)) ? -1 : Number(search) }, // won't match unless numeric
      { amount: { [Op.like]: `%${search}%` } },
    ];
  }

  const include = [
    {
      model: CustomerModel,
      as: "customer",
      attributes: ["id", "customerName", "businessName", "mobileNumber"],
    },
  ];

  const result = await TransactionModel.findAndCountAll({
    where,
    include,
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [[sortBy, sortDir]],
    distinct: true,
  });

  const rows = result.rows;
  let totalCredit = 0;
  let totalDebit = 0;

  rows.forEach((r) => {
    const amt = parseFloat(r.amount || 0);
    if (["sale", "refund"].includes(r.type)) totalCredit += amt;
    else if (["payment", "expense", "adjustment"].includes(r.type))
      totalDebit += amt;
  });

  const net = +(totalCredit - totalDebit).toFixed(2);

  return {
    total: result.count,
    rows,
    summary: {
      totalCredit: +totalCredit.toFixed(2),
      totalDebit: +totalDebit.toFixed(2),
      net,
    },
  };
};

exports.getTransactionById = async (id, vendorId) => {
  const where = { id };
  if (vendorId) where.vendorId = vendorId;
  const trx = await TransactionModel.findOne({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "mobileNumber"],
      },
    ],
  });
  if (!trx) throw new Error("Transaction not found");
  return trx;
};

exports.exportTransactionsCsv = async (filters = {}) => {
  const { vendorId, type, customerId, billId, challanId, fromDate, toDate } =
    filters;
  const where = {};
  if (vendorId) where.vendorId = vendorId;
  if (type) where.type = type;
  if (customerId) where.customerId = customerId;
  if (billId) where.billId = billId;
  if (challanId) where.challanId = challanId;
  if (fromDate)
    where.transactionDate = {
      ...(where.transactionDate || {}),
      [Op.gte]: fromDate,
    };
  if (toDate)
    where.transactionDate = {
      ...(where.transactionDate || {}),
      [Op.lte]: toDate,
    };

  const rows = await TransactionModel.findAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["customerName", "businessName", "mobileNumber"],
      },
    ],
    order: [["transactionDate", "DESC"]],
  });

  const header = [
    "id",
    "transactionDate",
    "type",
    "amount",
    "description",
    "customerName",
    "businessName",
    "mobileNumber",
    "billId",
    "challanId",
    "createdAt",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const line = [
      r.id,
      r.transactionDate,
      r.type,
      r.amount,
      `"${(r.description || "").replace(/"/g, '""')}"`,
      `"${(r.customer && (r.customer.customerName || "")).replace(
        /"/g,
        '""'
      )}"`,
      `"${(r.customer && (r.customer.businessName || "")).replace(
        /"/g,
        '""'
      )}"`,
      (r.customer && r.customer.mobileNumber) || "",
      r.billId || "",
      r.challanId || "",
      r.createdAt ? r.createdAt.toISOString() : "",
    ];
    lines.push(line.join(","));
  }

  return lines.join("\n");
};
