module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define(
    "Transaction",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      customerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      billId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Link payment to specific bill",
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("sale", "payment"),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      transactionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      challanNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "transactions",
      timestamps: true,
    }
  );

  return Transaction;
};
