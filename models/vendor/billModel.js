module.exports = (sequelize, DataTypes) => {
  const Bill = sequelize.define(
    "Bill",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      billNumber: { type: DataTypes.STRING, allowNull: false, unique: true },

      invoicePrefix: {
        type: DataTypes.STRING(10),
        allowNull: true,
        comment: "Invoice number prefix (e.g., INV, BILL)",
      },
      invoiceCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: "Sequential invoice count number",
      },
      invoiceTemplate: {
        type: DataTypes.ENUM("template1", "template2", "template3"),
        allowNull: false,
        defaultValue: "template1",
        comment: "Selected PDF template for this bill",
      },
      customInvoicePrefix: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      billDate: { type: DataTypes.DATEONLY, allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      gstTotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalWithoutGST: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalWithGST: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
        comment: "Total bill amount (same as totalWithGST)",
      },
      paidAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
        comment: "Total amount paid against this bill",
      },
      pendingAmount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
        comment: "Remaining amount to be paid",
      },

      status: {
        type: DataTypes.ENUM("pending", "paid", "partial", "cancelled"),
        defaultValue: "pending",
      },
      note: { type: DataTypes.TEXT, allowNull: true },
      challanIds: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "bills",
      timestamps: true,
      paranoid: true,
    },
  );

  return Bill;
};
