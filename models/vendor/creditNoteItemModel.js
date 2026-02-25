module.exports = (sequelize, DataTypes) => {
  const CreditNoteItem = sequelize.define(
    "CreditNoteItem",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      creditNoteId: {
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
      tableName: "credit_note_items",
      timestamps: true,
      paranoid: true,
    },
  );

  return CreditNoteItem;
};
