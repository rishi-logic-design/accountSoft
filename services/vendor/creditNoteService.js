const {
  CreditNoteModel,
  CreditNoteItemModel,
  CustomerModel,
  VendorModel,
  FirmModel,
  sequelize,
} = require("../../models");
const { Op } = require("sequelize");

function toNumber(v) {
  return parseFloat(v || 0);
}

async function generateNoteNumber(vendorId, type) {
  const prefix = type === "Sales Return" ? "SR" : "CN";
  const count = await CreditNoteModel.count({ where: { vendorId } });
  return `${prefix}-${new Date().getFullYear()}-${count + 1001}`;
}

exports.createCreditNote = async (vendorId, payload) => {
  const {
    customerId,
    type,
    noteNumber,
    noteDate,
    items = [],
    termsAndConditions,
    signatureImage,
    showSignature,
    note,
  } = payload;

  if (!customerId) throw new Error("customerId is required");

  return await sequelize.transaction(async (t) => {
    const finalNoteNumber =
      noteNumber || (await generateNoteNumber(vendorId, type));

    let subtotal = 0;
    let gstTotal = 0;

    const creditNoteItems = items.map((item) => {
      const qty = toNumber(item.qty || 1);
      const price = toNumber(item.price || 0);
      const amount = +(qty * price).toFixed(2);
      const gstPercent = toNumber(item.gstPercent || 0);
      const gstAmt = +((amount * gstPercent) / 100).toFixed(2);
      const total = +(amount + gstAmt).toFixed(2);

      subtotal += amount;
      gstTotal += gstAmt;

      return {
        itemName: item.itemName || "Item",
        hsn: item.hsn || "",
        qty,
        unit: item.unit || "",
        price,
        gstPercent,
        total,
      };
    });

    const totalAmount = +(subtotal + gstTotal).toFixed(2);

    const creditNote = await CreditNoteModel.create(
      {
        noteNumber: finalNoteNumber,
        noteDate: noteDate || new Date(),
        type: type || "Credit Note",
        vendorId,
        customerId,
        subtotal,
        gstTotal,
        totalAmount,
        termsAndConditions,
        signatureImage,
        showSignature: !!showSignature,
        status: "pending",
        note,
      },
      { transaction: t },
    );

    await CreditNoteItemModel.bulkCreate(
      creditNoteItems.map((i) => ({ ...i, creditNoteId: creditNote.id })),
      { transaction: t },
    );

    return await CreditNoteModel.findByPk(creditNote.id, {
      include: [
        { model: CreditNoteItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
      transaction: t,
    });
  });
};

exports.listCreditNotes = async ({
  vendorId,
  customerId,
  page = 1,
  size = 20,
  search,
  fromDate,
  toDate,
  status,
  sortBy = "noteDate",
  sortOrder = "DESC",
} = {}) => {
  const where = { vendorId };

  if (customerId) where.customerId = Number(customerId);
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.noteDate = {};
    if (fromDate) where.noteDate[Op.gte] = new Date(fromDate);
    if (toDate) {
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      where.noteDate[Op.lte] = endDate;
    }
  }

  if (search) {
    where[Op.or] = [{ noteNumber: { [Op.like]: `%${search}%` } }];
  }

  const result = await CreditNoteModel.findAndCountAll({
    where,
    include: [
      {
        model: CustomerModel,
        as: "customer",
        attributes: ["id", "customerName", "businessName", "mobile"],
      },
    ],
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [[sortBy, sortOrder.toUpperCase()]],
    distinct: true,
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};

exports.getCreditNoteById = async (id, vendorId) => {
  const creditNote = await CreditNoteModel.findOne({
    where: { id, vendorId },
    include: [
      { model: CreditNoteItemModel, as: "items" },
      { model: CustomerModel, as: "customer" },
      {
        model: VendorModel,
        as: "vendor",
        include: [{ model: FirmModel, as: "firm" }],
      },
    ],
  });

  if (!creditNote) throw new Error("Credit Note not found");

  return creditNote;
};

exports.deleteCreditNote = async (id, vendorId) => {
  return await sequelize.transaction(async (t) => {
    const creditNote = await CreditNoteModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!creditNote) throw new Error("Credit Note not found");

    await CreditNoteItemModel.destroy({
      where: { creditNoteId: creditNote.id },
      transaction: t,
    });

    await creditNote.destroy({ transaction: t });

    return true;
  });
};

exports.updateCreditNote = async (id, vendorId, payload) => {
  const {
    customerId,
    type,
    noteNumber,
    noteDate,
    items = [],
    termsAndConditions,
    signatureImage,
    showSignature,
    note,
    status,
  } = payload;

  return await sequelize.transaction(async (t) => {
    const creditNote = await CreditNoteModel.findOne({
      where: { id, vendorId },
      transaction: t,
    });

    if (!creditNote) throw new Error("Credit Note not found");

    let subtotal = 0;
    let gstTotal = 0;

    const creditNoteItems = items.map((item) => {
      const qty = toNumber(item.qty || 1);
      const price = toNumber(item.price || 0);
      const amount = +(qty * price).toFixed(2);
      const gstPercent = toNumber(item.gstPercent || 0);
      const gstAmt = +((amount * gstPercent) / 100).toFixed(2);
      const total = +(amount + gstAmt).toFixed(2);

      subtotal += amount;
      gstTotal += gstAmt;

      return {
        itemName: item.itemName || "Item",
        hsn: item.hsn || "",
        qty,
        unit: item.unit || "",
        price,
        gstPercent,
        total,
        creditNoteId: id,
      };
    });

    const totalAmount = +(subtotal + gstTotal).toFixed(2);

    await creditNote.update(
      {
        noteNumber: noteNumber || creditNote.noteNumber,
        noteDate: noteDate || creditNote.noteDate,
        type: type || creditNote.type,
        customerId: customerId || creditNote.customerId,
        subtotal,
        gstTotal,
        totalAmount,
        termsAndConditions:
          termsAndConditions !== undefined
            ? termsAndConditions
            : creditNote.termsAndConditions,
        signatureImage:
          signatureImage !== undefined
            ? signatureImage
            : creditNote.signatureImage,
        showSignature:
          showSignature !== undefined
            ? !!showSignature
            : creditNote.showSignature,
        status: status || creditNote.status,
        note: note !== undefined ? note : creditNote.note,
      },
      { transaction: t },
    );

    // Recreate items
    await CreditNoteItemModel.destroy({
      where: { creditNoteId: id },
      transaction: t,
    });

    await CreditNoteItemModel.bulkCreate(creditNoteItems, { transaction: t });

    return await CreditNoteModel.findByPk(id, {
      include: [
        { model: CreditNoteItemModel, as: "items" },
        { model: CustomerModel, as: "customer" },
      ],
      transaction: t,
    });
  });
};
