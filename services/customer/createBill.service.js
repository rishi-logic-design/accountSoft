const {
  BillModel,
  BillItemModel,
  CustomerModel,
  ProductModel,
  CategoryModel,
  SizeModel,
  ProductSizeModel,
  VendorModel,
  sequelize,
} = require("../models");
const { generateBillNumber } = require("../utils/bill.util");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

exports.computePrice = async ({
  productId,
  sizeId = null,
  length = null,
  qty = 1,
  gstPercentOverride = null,
}) => {
  const product = await ProductModel.findByPk(productId, {
    include: [{ model: CategoryModel, as: "category" }],
  });
  if (!product) throw new Error("Product not found");

  let unitRate = toNumber(product.price || 0);

  if (sizeId) {
    const ps = await ProductSizeModel.findOne({
      where: { productId, sizeId },
      include: [{ model: SizeModel, as: "size" }],
    });
    if (ps) {
      if (ps.price) unitRate = toNumber(ps.price);
    }
  }

  const amount = +(unitRate * toNumber(qty)).toFixed(2);
  const gstPercent =
    gstPercentOverride !== null
      ? toNumber(gstPercentOverride)
      : product.gstPercent || 0;
  const gstAmount = +((amount * gstPercent) / 100).toFixed(2);
  const totalWithGst = +(amount + gstAmount).toFixed(2);

  return {
    productId: product.id,
    productName: product.name,
    categoryId: product.categoryId,
    sizeId,
    sizeLabel: ps?.size?.label || null,
    length: length || null,
    unitRate,
    qty: toNumber(qty),
    amount,
    gstPercent,
    gstAmount,
    totalWithGst,
  };
};

exports.createBillFromItems = async (vendorId, payload) => {
  const { customerId, items: rawItems = [], gstOption = true, note } = payload;
  if (!customerId) throw new Error("customerId required");
  if (!Array.isArray(rawItems) || rawItems.length === 0)
    throw new Error("items required");

  return await sequelize.transaction(async (t) => {
    // validate vendor & customer
    const vendor = await VendorModel.findByPk(vendorId, { transaction: t });
    if (!vendor) throw new Error("Vendor not found");
    const customer = await CustomerModel.findByPk(customerId, {
      transaction: t,
    });
    if (!customer) throw new Error("Customer not found");

    // compute each item using computePrice
    const computed = [];
    for (const it of rawItems) {
      const comp = await exports.computePrice({
        productId: it.productId,
        sizeId: it.sizeId,
        length: it.length,
        qty: it.qty || 1,
        gstPercentOverride: it.gstPercent !== undefined ? it.gstPercent : null,
      });
      // attach challanId if provided
      if (it.challanId) comp.challanId = it.challanId;
      computed.push(comp);
    }

    // totals
    let subtotal = 0,
      gstTotal = 0;
    for (const c of computed) {
      subtotal += toNumber(c.amount);
      if (gstOption) gstTotal += toNumber(c.gstAmount);
    }
    subtotal = +subtotal.toFixed(2);
    gstTotal = +gstTotal.toFixed(2);
    const totalWithoutGST = subtotal;
    const totalWithGST = gstOption
      ? +(subtotal + gstTotal).toFixed(2)
      : subtotal;

    // generate bill number
    const billNumber = await generateBillNumber(BillModel, t);

    // create bill
    const bill = await BillModel.create(
      {
        billNumber,
        vendorId,
        customerId,
        billDate: new Date(),
        subtotal,
        gstTotal,
        totalWithoutGST,
        totalWithGST,
        status: "pending",
        note: note || null,
        challanIds:
          JSON.stringify(
            computed.filter((c) => c.challanId).map((c) => c.challanId)
          ) || null,
      },
      { transaction: t }
    );

    // create bill items
    const createItems = computed.map((c) => ({
      billId: bill.id,
      challanId: c.challanId || null,
      description: c.productName,
      qty: c.qty,
      rate: c.unitRate,
      amount: c.amount,
      gstPercent: c.gstPercent,
      totalWithGst: c.totalWithGst,
    }));
    await BillItemModel.bulkCreate(createItems, { transaction: t });

    // return populated bill
    const created = await BillModel.findByPk(bill.id, {
      transaction: t,
      include: [{ model: BillItemModel, as: "items" }],
    });

    return created;
  });
};
