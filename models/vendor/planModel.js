module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define(
    "Plan",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      priceMonthly: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.0 },
      priceYearly: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.0 },
      description: { type: DataTypes.TEXT },
    },
    {
      tableName: "plans",
      timestamps: true,
    }
  );

  return Plan;
};
