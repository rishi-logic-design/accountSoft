module.exports = (sequelize, DataTypes) => {
  const Vendor = sequelize.define(
    "Vendor",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      vendorName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        validate: { isEmail: true },
      },
      gst: DataTypes.STRING,
      mobile: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      address: DataTypes.TEXT,
      city: DataTypes.TEXT,
      state: DataTypes.TEXT,
      pinCode: DataTypes.TEXT,

      expiryDate: {
        type: DataTypes.DATEONLY,
      },

      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        defaultValue: "Active",
      },
      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
      },
    },
    {
      tableName: "vendor_vendors",
      timestamps: true,
    },
  );

  return Vendor;
};
