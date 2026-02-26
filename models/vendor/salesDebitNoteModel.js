module.exports = (sequelize, DataTypes) => {
  const SalesDebitNote = sequelize.define(
    "SalesDebitNote",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      noteNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      invoicePrefix: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      invoiceNo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      noteDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Supplier (Vendor)",
      },
      customerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: "The Buyer (Customer)",
      },
      taxableAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      gstTotal: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      otherCharge: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      invoiceDiscount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      finalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      paidAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      pendingAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      termsAndConditions: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      signatureImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      showSignature: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "unpaid",
          "partial",
          "paid",
          "completed",
          "cancelled",
        ),
        defaultValue: "pending",
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "sales_debit_notes",
      timestamps: true,
      paranoid: true,
    },
  );

  return SalesDebitNote;
};
