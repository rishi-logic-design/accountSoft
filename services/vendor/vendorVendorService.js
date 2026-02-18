const { Op } = require("sequelize");

const getModel = () => require("../../models").VendorVendorModel;

exports.createVendorVendor = async (data, createdBy) => {
  const VendorVendor = getModel();

  const existing = await VendorVendor.findOne({
    where: { mobile: data.mobile, createdBy },
  });

  if (existing) {
    const err = new Error("A vendor with this mobile number already exists");
    err.statusCode = 409;
    throw err;
  }

  const vendorVendor = await VendorVendor.create({
    vendorName: data.vendorName,
    email: data.email || null,
    gst: data.gst || null,
    mobile: data.mobile,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    pinCode: data.pinCode || null,
    expiryDate: data.expiryDate || null,
    status: data.status || "Active",
    createdBy,
  });

  return vendorVendor;
};

exports.getVendorVendors = async (createdBy, query) => {
  const VendorVendor = getModel();
  const { page = 1, size = 20, search, status } = query;
  const where = { createdBy };

  if (search) {
    where[Op.or] = [
      { vendorName: { [Op.like]: `%${search}%` } },
      { mobile: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { gst: { [Op.like]: `%${search}%` } },
      { city: { [Op.like]: `%${search}%` } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const limit = parseInt(size, 10);
  const offset = (parseInt(page, 10) - 1) * limit;

  const result = await VendorVendor.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: parseInt(page, 10),
    totalPages: Math.ceil(result.count / limit),
  };
};

exports.getVendorVendorById = async (id, createdBy) => {
  const VendorVendor = getModel();

  const vendorVendor = await VendorVendor.findOne({
    where: { id, createdBy },
  });

  if (!vendorVendor) {
    const err = new Error("Vendor not found");
    err.statusCode = 404;
    throw err;
  }

  return vendorVendor;
};

exports.updateVendorVendor = async (id, createdBy, data) => {
  const VendorVendor = getModel();

  const vendorVendor = await VendorVendor.findOne({
    where: { id, createdBy },
  });

  if (!vendorVendor) {
    const err = new Error("Vendor not found");
    err.statusCode = 404;
    throw err;
  }

  if (data.mobile && data.mobile !== vendorVendor.mobile) {
    const duplicate = await VendorVendor.findOne({
      where: {
        mobile: data.mobile,
        createdBy,
        id: { [Op.ne]: id },
      },
    });

    if (duplicate) {
      const err = new Error("A vendor with this mobile number already exists");
      err.statusCode = 409;
      throw err;
    }
  }

  await vendorVendor.update(data);
  return vendorVendor;
};

exports.deleteVendorVendor = async (id, createdBy) => {
  const VendorVendor = getModel();

  const vendorVendor = await VendorVendor.findOne({
    where: { id, createdBy },
  });

  if (!vendorVendor) {
    const err = new Error("Vendor not found");
    err.statusCode = 404;
    throw err;
  }

  await vendorVendor.destroy();
  return true;
};
