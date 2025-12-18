module.exports = (sequelize, DataTypes) => {
  const Vendor = sequelize.define(
    "Vendor",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorName: { type: DataTypes.STRING, allowNull: false },
      businessName: { type: DataTypes.STRING },
      address: { type: DataTypes.TEXT },
      subscriptionDate: { type: DataTypes.DATEONLY },
      expiryDate: { type: DataTypes.DATEONLY },
      createdBy: { type: DataTypes.INTEGER.UNSIGNED },
    },
    {
      tableName: "vendors",
      timestamps: true,
    }
  );
  return Vendor;
};