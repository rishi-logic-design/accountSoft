module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      sku: { type: DataTypes.STRING, allowNull: true, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      stock: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // vendor id
    },
    {
      tableName: "products",
      timestamps: true,
    }
  );

  return Product;
};
