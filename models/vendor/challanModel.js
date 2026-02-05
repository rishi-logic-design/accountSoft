module.exports = (sequelize, DataTypes) => {
  const Challan = sequelize.define(
    "Challan",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      challanNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      challanDate: { type: DataTypes.DATEONLY, allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      gstTotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalWithoutGST: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalWithGST: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      status: {
        type: DataTypes.ENUM("unpaid", "partial", "paid", "cancelled"),
        defaultValue: "unpaid",
      },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "challans",
      timestamps: true,
      paranoid: true,
    },
  );

  return Challan;
};
