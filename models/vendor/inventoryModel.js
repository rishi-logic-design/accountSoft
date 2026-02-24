module.exports = (sequelize, DataTypes) => {
  const Inventory = sequelize.define(
    "Inventory",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      salePrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      purchasePrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gst: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hsn: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      openingStock: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      currentStock: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      lowStockThreshold: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
      },
      customFields: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
    },
    {
      tableName: "inventories",
      timestamps: true,
      indexes: [
        {
          fields: ["vendorId"],
        },
        {
          fields: ["categoryId"],
        },
      ],
    },
  );

  return Inventory;
};
