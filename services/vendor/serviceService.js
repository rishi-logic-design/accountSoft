const { ServiceModel } = require("../../models");
const { Op } = require("sequelize");

exports.createService = async (vendorId, payload) => {
  return await ServiceModel.create({
    ...payload,
    vendorId,
  });
};

exports.listServices = async (
  vendorId,
  { search, page = 1, size = 20 } = {},
) => {
  const where = { vendorId };

  if (search) {
    where.name = { [Op.like]: `%${search}%` };
  }

  const result = await ServiceModel.findAndCountAll({
    where,
    limit: Number(size),
    offset: (Number(page) - 1) * Number(size),
    order: [["createdAt", "DESC"]],
  });

  return {
    total: result.count,
    rows: result.rows,
    page: Number(page),
    size: Number(size),
    totalPages: Math.ceil(result.count / Number(size)),
  };
};

exports.getServiceById = async (id, vendorId) => {
  const service = await ServiceModel.findOne({
    where: { id, vendorId },
  });
  if (!service) throw new Error("Service not found");
  return service;
};

exports.updateService = async (id, vendorId, payload) => {
  const service = await ServiceModel.findOne({
    where: { id, vendorId },
  });
  if (!service) throw new Error("Service not found");
  return await service.update(payload);
};

exports.deleteService = async (id, vendorId) => {
  const service = await ServiceModel.findOne({
    where: { id, vendorId },
  });
  if (!service) throw new Error("Service not found");
  await service.destroy();
  return true;
};
