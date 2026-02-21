module.exports = (sequelize, DataTypes) => {
  const VendorBill = sequelize.define(
    "VendorBill",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      billNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Purchase Invoice Number",
      },
      billDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Buyer (Our main vendor)",
      },
      sellerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Seller (Vendor's vendor)",
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      paidAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      pendingAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      billImage: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Firebase URL of the uploaded bill",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("unpaid", "partial", "paid", "cancelled"),
        allowNull: false,
        defaultValue: "unpaid",
      },
    },
    {
      tableName: "vendor_bills",
      timestamps: true,
      paranoid: true,
    },
  );

  return VendorBill;
};
