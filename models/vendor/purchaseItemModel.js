module.exports = (sequelize, DataTypes) => {
  const PurchaseItem = sequelize.define(
    "PurchaseItem",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      purchaseId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      productId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      hsn: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      qty: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      discount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      gstPercent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.0,
      },
      gstTotal: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      totalWithGst: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
    },
    {
      tableName: "purchase_items",
      timestamps: true,
      paranoid: true,
    },
  );

  return PurchaseItem;
};
