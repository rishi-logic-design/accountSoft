module.exports = (sequelize, DataTypes) => {
  const AccountTransaction = sequelize.define(
    "AccountTransaction",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The primary account involved in the transaction",
      },
      toAccountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Used for transfers (Contra Entry)",
      },
      transactionType: {
        type: DataTypes.ENUM(
          "DEPOSIT",
          "WITHDRAWAL",
          "TRANSFER",
          "ADJUSTMENT",
          "PAYMENT_IN",
          "PAYMENT_OUT",
        ),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      transactionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      voucherNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      remark: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      refId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "External reference ID (e.g., Payment ID, Bill ID)",
      },
      refType: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Type of external reference (e.g., 'Payment', 'Bill')",
      },
    },
    {
      tableName: "account_transactions",
      timestamps: true,
      indexes: [
        { fields: ["vendorId"] },
        { fields: ["accountId"] },
        { fields: ["toAccountId"] },
        { fields: ["transactionDate"] },
        { fields: ["transactionType"] },
      ],
    },
  );

  return AccountTransaction;
};
