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

      // Find the highest sequence number for today
      const lastChallan = await ChallanModel.findOne({
        where: {
          challanNumber: {
            [Op.like]: `${prefix}%`,
          },
        },
        order: [["challanNumber", "DESC"]],
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined,
        paranoid: false, // Include soft-deleted records
      });

      let sequence = 1;

      if (lastChallan && lastChallan.challanNumber) {
        // Extract the sequence number from the last challan number
        const parts = lastChallan.challanNumber.split("-");
        const lastSequence = parts[parts.length - 1];
        sequence = parseInt(lastSequence, 10) + 1;
      }

      // Add attempt number to ensure uniqueness in case of race conditions
      sequence = sequence + attempt;

      const seq = pad(sequence, 4);
      const challanNumber = `${prefix}-${seq}`;

      // Double-check if this number already exists
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
