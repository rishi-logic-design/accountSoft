module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define(
    "Customer",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      customerName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      businessName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true,
        },
      },
      gstNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      homeAddress: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
      },
      officeAddress: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
      },
      customerImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      aadharNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pricePerProduct: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
    },
    {
      tableName: "customers",
      timestamps: true,
    }
  );

  return Customer;
};
