module.exports = (sequelize, DataTypes) => {
  const SalesDebitNoteItem = sequelize.define(
    "SalesDebitNoteItem",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      salesDebitNoteId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      itemName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      hsn: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      qty: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 1.0,
      },
      unit: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      taxType: {
        type: DataTypes.ENUM("Inclusive", "Exclusive"),
        defaultValue: "Exclusive",
      },
      discount: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0.0,
      },
      taxableValue: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.0,
      },
      gstPercent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      total: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
    },
    {
      tableName: "sales_debit_note_items",
      timestamps: true,
      paranoid: true,
    },
  );

  return SalesDebitNoteItem;
};
