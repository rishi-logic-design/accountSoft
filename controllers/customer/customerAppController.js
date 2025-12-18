const asyncHandler = require("../utils/asyncHandler");
const { success, error } = require("../utils/apiResponse");
const {
  ChallanModel,
  ChallanItemModel,
  TransactionModel,
} = require("../models");

exports.listChallansForCustomer = asyncHandler(async (req, res) => {
  const customer = req.customer;
  const { status = "all", page = 1, size = 20 } = req.query;
  const where = { customerId: customer.id };

  if (status === "paid") where.status = "paid";
  if (status === "pending" || status === "unpaid")
    where.status = { [require("sequelize").Op.in]: ["unpaid", "partial"] };

  const result = await ChallanModel.findAndCountAll({
    where,
    include: [
      {
        model: ChallanItemModel,
        as: "items",
        attributes: ["productName", "qty", "pricePerUnit", "amount"],
      },
    ],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["challanDate", "DESC"]],
    distinct: true,
  });

  success(res, { total: result.count, rows: result.rows });
});

exports.getChallanDetail = asyncHandler(async (req, res) => {
  const customer = req.customer;
  const challanId = req.params.id;
  const challan = await ChallanModel.findOne({
    where: { id: challanId, customerId: customer.id },
    include: [{ model: ChallanItemModel, as: "items" }],
  });
  if (!challan) return error(res, "Challan not found", 404);

  // fetch payments linked to challan (if TransactionModel has challanId)
  const payments = TransactionModel
    ? await TransactionModel.findAll({
        where: { challanId: challan.id, customerId: customer.id },
        order: [["transactionDate", "DESC"]],
      })
    : [];

  // compute due
  const paid = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const due = +(parseFloat(challan.totalWithGST || 0) - paid).toFixed(2);

  success(res, { challan, payments, due });
});
