module.exports = (sequelize, DataTypes) => {
  const InventoryCategory = sequelize.define(
    "InventoryCategory",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
    },
    {
      tableName: "inventory_categories",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["name", "vendorId"],
        },
      ],
    },
  );

  return InventoryCategory;
};
