module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      openingBalance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      type: {
        type: DataTypes.ENUM("credit", "debit"),
        allowNull: false,
        comment: "credit = money received, debit = money paid",
      },
      subType: {
        type: DataTypes.ENUM(
          "customer",
          "vendor",
          "cash-deposit",
          "cash-withdrawal",
          "bank-charges",
          "electricity-bill",
          "miscellaneous",
        ),
        allowNull: false,
        defaultValue: "customer",
        comment: "Payment sub-category",
      },
      amount: {
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
        comment: "Reference/Transaction ID",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Array of attachment URLs",
      },
      billId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Linked bill ID if payment is against a bill",
      },
      challanId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Linked challan ID if payment is against a challan",
      },

      // Payment status
      status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "cancelled"),
        allowNull: false,
        defaultValue: "completed",
      },
      // Outstanding tracking
      totalOutstanding: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.0,
        comment: "Total outstanding before this payment",
      },
      outstandingAfterPayment: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.0,
        comment: "Outstanding after this payment",
      },
      // Invoice adjustments
      adjustedInvoices: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Array of invoices adjusted with this payment",
      },
    },
    {
      tableName: "payments",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["vendorId"] },
        { fields: ["customerId"] },
        { fields: ["paymentDate"] },
        { fields: ["type"] },
        { fields: ["subType"] },
        { fields: ["status"] },
        { fields: ["paymentNumber"], unique: true },
      ],
    },
  );

  return Payment;
};
