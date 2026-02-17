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
      itemName: { type: DataTypes.STRING, allowNull: false },
      hsn: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
      },
      qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      discount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      gstPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      gstTotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
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
    },
  );

  return BillItem;
};
