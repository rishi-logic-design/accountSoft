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
  doc.fontSize(18).text("CHALLAN", { align: "center" });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Challan No: ${challan.challanNumber}`);
  doc.text(`Date: ${challan.challanDate}`);

  doc.moveDown();
  doc.text(`Vendor: ${challan.vendor.vendorName}`);
  doc.text(`Vendor Mobile: ${challan.vendor.mobile || "-"}`);

  doc.moveDown();
  doc.text(`Customer: ${challan.customer.customerName}`);
  doc.text(`Customer Mobile: ${challan.customer.mobile || "-"}`);

  doc.moveDown();
  doc.text("Items", { underline: true });
  doc.moveDown(0.3);

  challan.items.forEach((item, index) => {
    doc.text(
      `${index + 1}. ${item.productName} | Qty: ${item.qty} | Rate: ₹${item.pricePerUnit} | Amount: ₹${item.amount}`,
    );
  });

  doc.moveDown();
  doc.text(`Subtotal: ₹${challan.subtotal}`);
  doc.text(`GST: ₹${challan.gstTotal}`);
  doc.text(`Total: ₹${challan.totalWithGST}`);
  doc.text(`Status: ${challan.status.toUpperCase()}`);

  if (challan.note) {
    doc.moveDown();
    doc.text(`Note: ${challan.note}`);
  }

  doc.end();
  return await endPromise;
};
