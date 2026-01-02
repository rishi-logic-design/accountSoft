const { GstSlabModel } = require("../../models");

exports.createGstSlab = async (payload) => {
  return await GstSlabModel.create(payload);
};

exports.listGstSlabs = async (vendorId, options = {}) => {
  const { includeInactive = false } = options;

  const where = { vendorId };

  if (!includeInactive) {
    where.active = true;
  }

  return await GstSlabModel.findAll({
    where,
    order: [
      ["priority", "DESC"],
      ["rate", "ASC"],
      ["createdAt", "DESC"],
    ],
  });
};

exports.getGstSlab = async (vendorId, id) => {
  return await GstSlabModel.findOne({
    where: { id, vendorId },
  });
};

exports.findBySlabName = async (vendorId, slabName) => {
  return await GstSlabModel.findOne({
    where: {
      vendorId,
      slabName: slabName.trim(),
    },
  });
};

exports.updateGstSlab = async (vendorId, id, updates) => {
  const slab = await GstSlabModel.findOne({
    where: { id, vendorId },
  });

  if (!slab) {
    throw new Error("GST slab not found");
  }

  await slab.update(updates);
  return slab;
};

exports.softDeleteGstSlab = async (vendorId, id) => {
  const slab = await GstSlabModel.findOne({
    where: { id, vendorId },
  });

  if (!slab) {
    throw new Error("GST slab not found");
  }

  await slab.update({ active: false });
  return true;
};

exports.hardDeleteGstSlab = async (vendorId, id) => {
  const slab = await GstSlabModel.findOne({
    where: { id, vendorId },
  });

  if (!slab) {
    throw new Error("GST slab not found");
  }

  await slab.destroy();
  return true;
};

exports.getActiveSlabs = async (vendorId) => {
  return await GstSlabModel.findAll({
    where: {
      vendorId,
      active: true,
    },
    order: [
      ["priority", "DESC"],
      ["rate", "ASC"],
    ],
  });
};

exports.getSlabByRate = async (vendorId, rate) => {
  return await GstSlabModel.findOne({
    where: {
      vendorId,
      rate,
      active: true,
    },
  });
};

exports.slabExists = async (vendorId, slabName) => {
  const count = await GstSlabModel.count({
    where: { vendorId, slabName: slabName.trim() },
  });
  return count > 0;
};
