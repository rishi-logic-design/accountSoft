module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      businessName: { type: DataTypes.STRING, allowNull: true },
      customerName: { type: DataTypes.STRING, allowNull: false },
      mobileNumber: { type: DataTypes.STRING, allowNull: false },
      gstNumber: { type: DataTypes.STRING, allowNull: true },
      homeAddress: { type: DataTypes.TEXT, allowNull: true },
      officeAddress: { type: DataTypes.TEXT, allowNull: true },
      customerImage: { type: DataTypes.STRING, allowNull: true },
      aadharNumber: { type: DataTypes.STRING, allowNull: true },
      pricePerProduct: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    },
    {
      tableName: "customers",
      timestamps: true,
    }
  );

  return Customer;
};
