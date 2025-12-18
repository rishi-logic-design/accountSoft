module.exports = (sequelize, DataTypes) => {
  const GstSlab = sequelize.define(
    "GstSlab",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, 
      slabName: { type: DataTypes.STRING, allowNull: false }, 
      rate: { type: DataTypes.DECIMAL(5, 2), allowNull: false }, 
      priority: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 }, 
      active: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      tableName: "gst_slabs",
      timestamps: true,
      indexes: [{ fields: ["vendorId"] }],
    }
  );

  return GstSlab;
};
