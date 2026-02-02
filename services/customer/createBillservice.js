const PDFDocument = require("pdfkit");
const { Op } = require("sequelize");
const {
  BillModel,
  BillItemModel,
  VendorModel,
  CustomerModel,
} = require("../../models");

exports.list = async (customerId, filters = {}) => {
  const { page = 1, size = 20, search, status, fromDate, toDate } = filters;

  const where = {
    customerId: Number(customerId),
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where[Op.or] = [{ billNumber: { [Op.like]: `%${search}%` } }];
  }

  if (fromDate || toDate) {
    where.billDate = {};
    if (fromDate) where.billDate[Op.gte] = fromDate;
    if (toDate) where.billDate[Op.lte] = toDate;
  }

  const result = await BillModel.findAndCountAll({
    where,
    distinct: true,
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

exports.generateMyBillPdf = async (billId, customerId) => {
  const bill = await BillModel.findOne({
    where: {
      id: billId,
      customerId,
    },
    include: [
      { model: BillItemModel, as: "items" },
      { model: VendorModel, as: "vendor" },
      { model: CustomerModel, as: "customer" },
    ],
  });

  if (!bill) {
    throw new Error("Bill not found for this customer");
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
