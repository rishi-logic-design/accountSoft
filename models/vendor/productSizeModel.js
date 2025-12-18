module.exports = (sequelize, DataTypes) => {
  const ProductSize = sequelize.define(
    "ProductSize",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      productId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      sizeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      stock: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    },
    {
      tableName: "product_sizes",
      timestamps: true,
      indexes: [{ unique: true, fields: ["productId", "sizeId"] }],
    }
  );

  return ProductSize;
};
