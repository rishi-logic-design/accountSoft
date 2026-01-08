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

  const where = {
    challanDate: `${y}-${m}-${d}`,
  };

  const count = await ChallanModel.count({ where, transaction });
  const seq = pad(count + 1, 4);
  return `${prefix}-${seq}`;
};
