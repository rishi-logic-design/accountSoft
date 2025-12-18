module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define(
    "Subscription",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      vendorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      planId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      startDate: { type: DataTypes.DATEONLY },
      endDate: { type: DataTypes.DATEONLY },
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

  return Subscription;
};
