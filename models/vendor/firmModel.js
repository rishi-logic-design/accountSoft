module.exports = (sequelize, DataTypes) => {
  const Firm = sequelize.define(
    "Firm",
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
      firmName: { type: DataTypes.STRING, allowNull: false },
      addressLine1: { type: DataTypes.STRING, allowNull: true },
      addressLine2: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },
      pincode: { type: DataTypes.STRING, allowNull: true },
      gstNumber: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      extra: { type: DataTypes.JSON, allowNull: true },
    },
    {
      tableName: "firms",
      timestamps: true,
      paranoid: true,
    }
  );

  return Firm;
};
