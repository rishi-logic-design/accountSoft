module.exports = (sequelize, DataTypes) => {
  const BillItem = sequelize.define(
    "BillItem",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      billId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      challanId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, 
      description: { type: DataTypes.STRING, allowNull: false },
      qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
      },
      rate: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      gstPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      totalWithGst: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
    },
    {
      tableName: "bill_items",
      timestamps: true,
      paranoid: true,
    }
  );

  return BillItem;
};
