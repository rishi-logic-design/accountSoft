const { Op } = require("sequelize");

const pad = (num, size) => {
  let s = String(num);
  while (s.length < size) s = "0" + s;
  return s;
};

exports.generateChallanNumber = async (ChallanModel, transaction = null) => {
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = pad(today.getMonth() + 1, 2);
      const d = pad(today.getDate(), 2);
      const prefix = `CH-${y}${m}${d}`;

      const lastChallan = await ChallanModel.findOne({
        where: {
          challanNumber: {
            [Op.like]: `${prefix}%`,
          },
        },
        order: [["challanNumber", "DESC"]],
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined,
        paranoid: false,
      });

      let sequence = 1;

      if (lastChallan && lastChallan.challanNumber) {
        const parts = lastChallan.challanNumber.split("-");
        const lastSequence = parts[parts.length - 1];
        sequence = parseInt(lastSequence, 10) + 1;
      }

      sequence = sequence + attempt;

      const seq = pad(sequence, 4);
      const challanNumber = `${prefix}-${seq}`;

      const exists = await ChallanModel.findOne({
        where: { challanNumber },
        transaction,
        paranoid: false,
      });

      if (!exists) {
        return challanNumber;
      }

      console.log(
        `Challan number ${challanNumber} already exists, retrying...`,
      );
    } catch (error) {
      console.error(
        `Error generating challan number (attempt ${attempt + 1}):`,
        error.message,
      );

      if (attempt === maxRetries - 1) {
        throw new Error(
          "Failed to generate unique challan number after multiple attempts",
        );
      }
    }
  }

  throw new Error("Failed to generate unique challan number");
};
