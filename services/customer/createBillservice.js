const PDFDocument = require("pdfkit");
const { Op } = require("sequelize");
const {
  BillModel,
  BillItemModel,
  VendorModel,
  CustomerModel,
} = require("../../models");
const { renderTemplate } = require("../../utils/templateRenderer");
const InvoiceSettings = require("../../models/vendor/invoiceSettingsModel");

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

exports.getMyBillHtml = async (billId, customerId) => {
  try {
    const bill = await BillModel.findOne({
      where: {
        id: Number(billId),
        customerId: Number(customerId),
      },
      include: [
        {
          model: VendorModel,
          as: "vendor",
          required: false,
        },
        {
          model: CustomerModel,
          as: "customer",
          required: false,
        },
        {
          model: BillItemModel,
          as: "items",
          required: false,
        },
      ],
    });

    if (!bill) {
      return {
        html: "<h2>Bill not found</h2>",
        templateId: null,
        billNumber: null,
      };
    }

    const settings = await InvoiceSettings.findOne({
      where: { vendorId: bill.vendorId },
    });

    const templateId = settings?.invoiceTemplate || "template1";

    const formatAddress = (address) => {
      if (!address) return "Address not provided";
      try {
        const addr =
          typeof address === "string" ? JSON.parse(address) : address;

        return [
          addr.houseNo,
          addr.streetNo,
          addr.residencyName,
          addr.areaCity,
          addr.state,
          addr.pincode,
        ]
          .filter(Boolean)
          .join(", ");
      } catch {
        return address;
      }
    };

    const totalQty = (bill.items || []).reduce((sum, item) => {
      return sum + parseFloat(item.qty || item.quantity || 0);
    }, 0);

    const templateData = {
      billNumber: bill.billNumber || "",
      date: bill.billDate || new Date(),
      dueDate: bill.dueDate || "",
      customer: {
        name: bill.customer?.customerName || "N/A",
        company: bill.customer?.company || bill.customer?.businessName || "",
        address: formatAddress(bill.customer?.homeAddress),
        gstNumber: bill.customer?.gstNumber || "",
        phone: bill.customer?.mobileNumber || bill.customer?.mobile || "",
      },
      items: (bill.items || []).map((item) => ({
        description: item.description || item.itemName || "",
        itemName: item.itemName || item.description || "",
        quantity: item.qty || item.quantity || 0,
        qty: item.qty || item.quantity || 0,
        unit: item.unit || "",
        rate: item.rate || item.price || 0,
        price: item.price || item.rate || 0,
        amount: item.amount || item.total || 0,
        total: item.total || item.amount || 0,
        hsn: item.hsn || "",
      })),
      totalQty,
      subtotal: bill.subtotal || bill.totalWithoutGST || 0,
      gstPercentage: bill.gstPercentage || 18,
      gstTotal: bill.gstTotal || bill.gst || 0,
      totalAmount: bill.totalWithGST || bill.totalAmount || 0,
      paidAmount: bill.paidAmount || 0,
      pendingAmount: bill.pendingAmount || 0,
      status: bill.status || "pending",
      notes: bill.note || bill.notes || "",
    };

    const html = renderTemplate(templateId, templateData);

    return {
      html,
      templateId,
      billNumber: bill.billNumber,
    };
  } catch (error) {
    console.error("getMyBillHtml Error:", error);
    throw error;
  }
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
