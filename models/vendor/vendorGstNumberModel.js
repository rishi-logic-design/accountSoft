module.exports = (sequelize, DataTypes) => {
  const VendorGstNumber = sequelize.define(
    "VendorGstNumber",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      gstNumber: {
        type: DataTypes.STRING(15),
        allowNull: false,
      },
    },
    {
      tableName: "vendor_gst_numbers",
      timestamps: true,
    }
  );

  return VendorGstNumber;
};
