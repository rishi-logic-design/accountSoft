const { FirmModel, GstSlabModel, sequelize } = require("../../models/vendor/vendorModel");
const { Op } = require("sequelize");

function validateRate(r) {
  const n = parseFloat(r);
  if (Number.isNaN(n) || n < 0 || n > 100) throw new Error("Invalid GST rate");
  return +n.toFixed(2);
}

exports.getFirm = async (vendorId) => {
  const firm = await FirmModel.findOne({ where: { vendorId } });
  return firm;
};

exports.upsertFirm = async (vendorId, payload) => {
  return await sequelize.transaction(async (t) => {
    const existing = await FirmModel.findOne({
      where: { vendorId },
      transaction: t,
    });
    if (existing) {
      await existing.update(payload, { transaction: t });
      return existing;
    }
    const created = await FirmModel.create(
      { vendorId, ...payload },
      { transaction: t }
    );
    return created;
  });
};

exports.createGstSlab = async (vendorId, payload) => {
  const rate = validateRate(payload.rate);
  const slabName = payload.slabName || `${rate}%`;
  const created = await GstSlabModel.create({
    vendorId,
    slabName,
    rate,
    priority: payload.priority || 0,
    active: payload.active === undefined ? true : !!payload.active,
  });
  return created;
};

exports.updateGstSlab = async (vendorId, slabId, payload) => {
  const slab = await GstSlabModel.findOne({ where: { id: slabId, vendorId } });
  if (!slab) throw new Error("GST slab not found");
  if (payload.rate !== undefined) payload.rate = validateRate(payload.rate);
  await slab.update(payload);
  return slab;
};

exports.deleteGstSlab = async (vendorId, slabId, soft = true) => {
  const slab = await GstSlabModel.findOne({ where: { id: slabId, vendorId } });
  if (!slab) throw new Error("GST slab not found");
  if (soft) {
    await slab.update({ active: false });
  } else {
    await slab.destroy();
  }
  return true;
};

exports.listGstSlabs = async (vendorId, { includeInactive = false } = {}) => {
  const where = { vendorId };
  if (!includeInactive) where.active = true;
  const rows = await GstSlabModel.findAll({
    where,
    order: [
      ["priority", "ASC"],
      ["rate", "ASC"],
    ],
  });
  return rows;
};

exports.getGstSlab = async (vendorId, slabId) => {
  const slab = await GstSlabModel.findOne({ where: { id: slabId, vendorId } });
  if (!slab) throw new Error("GST slab not found");
  return slab;
};
