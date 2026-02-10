module.exports = (sequelize, DataTypes) => {
  const VendorInvoiceSettings = sequelize.define(
    "VendorInvoiceSettings",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        comment: "Reference to vendor",
      },
      prefix: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "INV",
        comment: "Invoice number prefix (e.g., INV, BILL)",
      },
      startCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1001,
        comment: "Starting invoice number",
      },
      currentCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1001,
        comment: "Next available invoice number",
      },
      invoiceTemplate: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: "template1",
        comment:
          "Default template for invoices (template1, template2, template3)",
      },
      usedNumbers: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: "[]",
        comment: "JSON array of used invoice numbers",
      },
    },
    {
      tableName: "vendor_invoice_settings",
      timestamps: true,
      paranoid: false,
    },
  );

  return VendorInvoiceSettings;
};
