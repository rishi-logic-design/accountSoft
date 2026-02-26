module.exports = (sequelize, DataTypes) => {
  const Purchase = sequelize.define(
    "Purchase",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      purchaseNumber: {
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
      totalAmount: {
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
      status: {
        type: DataTypes.ENUM(
          "unpaid",
          "pending",
          "partial",
          "paid",
          "completed",
          "cancelled",
        ),
        allowNull: false,
        defaultValue: "unpaid",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
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
