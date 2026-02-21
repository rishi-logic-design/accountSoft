module.exports = (sequelize, DataTypes) => {
  const Purchase = sequelize.define(
    "Purchase",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      purchaseType: {
        type: DataTypes.STRING(50),
        defaultValue: "Tax Invoice",
      },
      prefix: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      purchaseNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Invoice number as per user request",
      },
      purchaseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "Buyer details (Our main vendor)",
      },
      sellerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "Seller details (Vendor's vendor)",
      },
      subtotal: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      gstTotal: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      termsAndConditions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      signature: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Firebase link for uploaded signature",
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "unpaid",
          "partial",
          "paid",
          "cancelled",
        ),
        defaultValue: "pending",
      },
      paidAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      pendingAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
    },
    {
      tableName: "purchases",
      timestamps: true,
      paranoid: true,
    },
  );

  return Purchase;
};
