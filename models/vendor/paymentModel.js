module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      paymentNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // inward payments
      type: { type: DataTypes.ENUM("inward", "outward"), allowNull: false },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
      method: {
        type: DataTypes.ENUM("cash", "bank", "cheque", "online", "other"),
        allowNull: false,
        defaultValue: "cash",
      },
      reference: { type: DataTypes.STRING, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      attachments: { type: DataTypes.TEXT, allowNull: true },
      billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      challanId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    },
    {
      tableName: "payments",
      timestamps: true,
      paranoid: true,
    }
  );

  return Payment;
};
