module.exports = (sequelize, DataTypes) => {
  const VendorPaymentDetails = sequelize.define(
    "VendorPaymentDetails",
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
      bankName: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      accountNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      ifscCode: {
        type: DataTypes.STRING(11),
        allowNull: true,
      },
      upiId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      qrCodeAttachment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "vendor_payment_details",
      timestamps: true,
    }
  );

  return VendorPaymentDetails;
};