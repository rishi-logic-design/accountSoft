const { FirmModel } = require("../../models");

exports.getFirm = async (vendorId) => {
  return await FirmModel.findOne({
    where: { vendorId },
  });
};

exports.upsertFirm = async (vendorId, payload) => {
  const existing = await FirmModel.findOne({ where: { vendorId } });

  if (existing) {
    await existing.update(payload);
    return existing;
  } else {
    // Create new firm
    return await FirmModel.create({
      vendorId,
      ...payload,
    });
  }
};

exports.updateFirm = async (vendorId, updates) => {
  const firm = await FirmModel.findOne({ where: { vendorId } });

  if (!firm) {
    throw new Error("Firm not found");
  }

  await firm.update(updates);
  return firm;
};

exports.deleteFirm = async (vendorId) => {
  const firm = await FirmModel.findOne({ where: { vendorId } });

  if (!firm) {
    throw new Error("Firm not found");
  }

  await firm.destroy();
  return true;
};

exports.firmExists = async (vendorId) => {
  const count = await FirmModel.count({ where: { vendorId } });
  return count > 0;
};