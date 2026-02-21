module.exports = (sequelize, DataTypes) => {
  const PurchaseBill = sequelize.define(
    "PurchaseBill",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Purchase Invoice Number",
      },
      purchaseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Buyer (Current Vendor)",
      },
      sellerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Seller (Vendor's Vendor)",
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
      billUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Firebase URL of the uploaded bill",
      },
      status: {
        type: DataTypes.ENUM("unpaid", "partial", "paid", "cancelled"),
        allowNull: false,
        defaultValue: "unpaid",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "purchase_bills",
      timestamps: true,
      paranoid: true,
    },
  );

  return PurchaseBill;
};
