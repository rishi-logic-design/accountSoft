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

      businessName: DataTypes.STRING,

      mobile: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      email: {
        type: DataTypes.STRING,
        validate: { isEmail: true },
      },

      gst: DataTypes.STRING,
      address: DataTypes.TEXT,
      bankAccount: DataTypes.STRING,

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
      tableName: "vendors",
      timestamps: true,
    }
  );

  Vendor.associate = (models) => {
    Vendor.hasMany(models.Subscription, {
      foreignKey: "vendorId",
      as: "subscriptions",
    });
  };

  return Vendor;
};
