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
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      billDate: { type: DataTypes.DATEONLY, allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      gstTotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalWithoutGST: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
      totalWithGST: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
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
    }
  );

  return Bill;
};
