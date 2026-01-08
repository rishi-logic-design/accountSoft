module.exports = (sequelize, DataTypes) => {
  const VendorGstNumber = sequelize.define(
    "VendorGstNumber",
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: {
        type: DataTypes.BIGINT.UNSIGNED,
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
