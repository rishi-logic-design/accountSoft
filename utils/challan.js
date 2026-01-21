const { Op } = require("sequelize");

const pad = (num, size) => {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
};

exports.generateChallanNumber = async (ChallanModel, transaction = null) => {
  const today = new Date();
  const y = today.getFullYear();

  const totalCount = await ChallanModel.count({
    transaction,
    paranoid: false, 
  });

  const sequence = totalCount + 1;
  const seq = pad(sequence, 5); 

  return `CH-${y}-${seq}`;
};

exports.generateVendorChallanNumber = async (
  ChallanModel,
  vendorId,
  transaction = null,
) => {
  const today = new Date();
  const y = today.getFullYear();

  const vendorCount = await ChallanModel.count({
    where: { vendorId },
    transaction,
    paranoid: false,
  });

  const sequence = vendorCount + 1;
  const seq = pad(sequence, 4);

  return `CH-V${vendorId}-${y}-${seq}`;
};

exports.generateDateBasedChallanNumber = async (
  ChallanModel,
  transaction = null,
) => {
  const today = new Date();
  const y = today.getFullYear();
  const m = pad(today.getMonth() + 1, 2);
  const d = pad(today.getDate(), 2);
  const prefix = `CH-${y}${m}${d}`;

  const [results] = await ChallanModel.sequelize.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(challanNumber, -4) AS UNSIGNED)), 0) as maxSeq 
     FROM challans 
     WHERE challanNumber LIKE :prefix 
     AND deletedAt IS NULL`,
    {
      replacements: { prefix: `${prefix}%` },
      type: ChallanModel.sequelize.QueryTypes.SELECT,
      transaction,
    },
  );

  const sequence = (results.maxSeq || 0) + 1;
  const seq = pad(sequence, 4);

  return `${prefix}-${seq}`;
};
