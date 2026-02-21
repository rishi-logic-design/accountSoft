module.exports = (sequelize, DataTypes) => {
  const PurchasePayment = sequelize.define(
    "PurchasePayment",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      receiptNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
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
      advanceAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      method: {
        type: DataTypes.ENUM(
          "cash",
          "bank",
          "cheque",
          "online",
          "upi",
          "card",
          "other",
        ),
        allowNull: false,
        defaultValue: "cash",
      },
      reference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "cancelled"),
        allowNull: false,
        defaultValue: "completed",
      },
      adjustedPurchases: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Array of purchase IDs and amounts adjusted",
      },
    },
    {
      tableName: "purchase_payments",
      timestamps: true,
      paranoid: true,
    },
  );

  return PurchasePayment;
};
