module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define(
    "Subscription",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      planId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM("active", "expired", "cancelled"),
        defaultValue: "active",
      },
    },
    {
      tableName: "subscriptions",
      timestamps: true,
    }
  );

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.Vendor, {
      foreignKey: "vendorId",
      as: "vendor",
    });

    Subscription.belongsTo(models.Plan, {
      foreignKey: "planId",
      as: "plan",
    });
  };

  return Subscription;
};
