const { Op } = require("sequelize");

const pad = (num, size) => {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
};

exports.generateChallanNumber = async (ChallanModel, transaction = null) => {
  const today = new Date();
  const y = today.getFullYear();
  const m = pad(today.getMonth() + 1, 2);
  const d = pad(today.getDate(), 2);
  const prefix = `CH-${y}${m}${d}`;

  // Find the last challan number with this prefix
  const lastChallan = await ChallanModel.findOne({
    where: {
      challanNumber: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["challanNumber", "DESC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let sequence = 1;

  if (lastChallan && lastChallan.challanNumber) {
    // Extract the sequence number from the last challan number
    const lastSequence = lastChallan.challanNumber.split("-").pop();
    sequence = parseInt(lastSequence, 10) + 1;
  }

  const seq = pad(sequence, 4);
  return `${prefix}-${seq}`;
};
