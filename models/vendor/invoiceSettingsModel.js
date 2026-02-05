module.exports = (sequelize, DataTypes) => {
  const InvoiceSettings = sequelize.define(
    "InvoiceSettings",
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
      },
      prefix: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "INV",
        comment: "Invoice number prefix (e.g., INV, BILL, etc.)",
      },
      startCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1001,
        comment: "Starting count for invoice numbers",
      },
      currentCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1001,
        comment: "Current invoice count",
      },
      invoiceTemplate: {
        type: DataTypes.ENUM("template1", "template2", "template3"),
        allowNull: false,
        defaultValue: "template1",
        comment: "Selected invoice template format",
      },
      usedNumbers: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "JSON array of used invoice numbers to prevent duplicates",
        get() {
          const value = this.getDataValue("usedNumbers");
          return value ? JSON.parse(value) : [];
        },
        set(value) {
          this.setDataValue("usedNumbers", JSON.stringify(value || []));
        },
      },
    },
    {
      tableName: "invoice_settings",
      timestamps: true,
      paranoid: false,
    },
  );

  return InvoiceSettings;
};
