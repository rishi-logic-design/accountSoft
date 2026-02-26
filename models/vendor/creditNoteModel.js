module.exports = (sequelize, DataTypes) => {
  const CreditNote = sequelize.define(
    "CreditNote",
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
      noteDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("Credit Note", "Sales Return"),
        defaultValue: "Credit Note",
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
      tableName: "credit_notes",
      timestamps: true,
      paranoid: true,
    },
  );

  return CreditNote;
};
