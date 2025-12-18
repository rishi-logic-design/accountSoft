module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define(
    "Transaction",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      type: {
        type: DataTypes.ENUM(
          "sale",
          "payment",
          "refund",
          "expense",
          "adjustment"
        ),
        allowNull: false,
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      transactionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      challanId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      paymentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // optional link to payment entry
    },
    {
      tableName: "transactions",
      timestamps: true,
      indexes: [
        { fields: ["vendorId"] },
        { fields: ["customerId"] },
        { fields: ["transactionDate"] },
      ],
    }
  );

  return Transaction;
};
