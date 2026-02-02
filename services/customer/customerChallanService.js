const PDFDocument = require("pdfkit");
const { Op } = require("sequelize");
const {
  ChallanModel,
  ChallanItemModel,
  CustomerModel,
  VendorModel,
} = require("../../models");

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
exports.generateMyChallanPdf = async (challanId, customerId) => {
  const challan = await ChallanModel.findOne({
    where: {
      id: challanId,
      customerId,
    },
    include: [
      { model: ChallanItemModel, as: "items" },
      { model: VendorModel, as: "vendor" },
      { model: CustomerModel, as: "customer" },
    ],
  });

  if (!challan) {
    throw new Error("Challan not found for this customer");
  }

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));
  const endPromise = new Promise((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(buffers))),
  );

  // ===== PDF CONTENT =====
  doc.fontSize(18).text(`Bill`, { align: "center" });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Bill No: ${bill.billNumber}`);
  doc.text(`Date: ${bill.billDate}`);

  doc.moveDown();
  doc.text(`Vendor: ${bill.vendor.vendorName}`);
  doc.text(`Vendor Mobile: ${bill.vendor.mobile || "-"}`);

  doc.moveDown();
  doc.text(`Customer: ${bill.customer.customerName}`);
  doc.text(`Customer Mobile: ${bill.customer.mobile || "-"}`);

  doc.moveDown();
  doc.text("Items", { underline: true });
  doc.moveDown(0.3);

  bill.items.forEach((item, index) => {
    doc.text(
      `${index + 1}. ${item.description} | Qty: ${item.qty} | Rate: ₹${item.rate} | Amt: ₹${item.amount}`,
    );
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${bill.subtotal}`);
  doc.text(`GST: ₹${bill.gstTotal}`);
  doc.text(`Total: ₹${bill.totalWithGST}`);
  doc.text(`Status: ${bill.status.toUpperCase()}`);

  if (bill.note) {
    doc.moveDown();
    doc.text(`Note: ${bill.note}`);
  }

  doc.end();
  return await endPromise;
};
