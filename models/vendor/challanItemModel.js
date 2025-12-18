// models/challanItem.model.js
module.exports = (sequelize, DataTypes) => {
  const ChallanItem = sequelize.define(
    "ChallanItem",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      challanId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, 
      productName: { type: DataTypes.STRING, allowNull: false },
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      size: { type: DataTypes.STRING, allowNull: true },
      length: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
      },
      pricePerUnit: {
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
      tableName: "challan_items",
      timestamps: true,
      paranoid: true,
    }
  );

  return ChallanItem;
};
