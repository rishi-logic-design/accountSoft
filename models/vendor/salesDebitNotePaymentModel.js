module.exports = (sequelize, DataTypes) => {
  const SalesDebitNotePayment = sequelize.define(
    "SalesDebitNotePayment",
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
      salesDebitNoteId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Supplier (Our main vendor)",
      },
      customerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Buyer (Customer)",
      },
      accountId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Linked Cash/Bank account",
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
    },
    {
      tableName: "sales_debit_note_payments",
      timestamps: true,
      paranoid: true,
    },
  );

  return SalesDebitNotePayment;
};
