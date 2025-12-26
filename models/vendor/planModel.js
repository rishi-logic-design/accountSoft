module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define(
    "Plan",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },

      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment:
          'Plan name (e.g., "1 Month", "3 Months", "6 Months", "Annual")',
      },

      duration: {
        type: DataTypes.INTEGER, // 1, 3, 6, 12
        allowNull: false,
        defaultValue: 1,
        comment: "Duration value (e.g., 1, 3, 6, 12)",
      },

      durationUnit: {
        type: DataTypes.ENUM("month", "year"),
        allowNull: false,
        defaultValue: "month",
        comment: "Unit of duration (month or year)",
      },

      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
        comment: "Base price for this plan",
      },

      priceMonthly: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
        comment: "Monthly price (optional, for reference)",
      },

      priceYearly: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
        comment: "Yearly price (optional, for reference)",
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Plan description",
      },

      features: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: "Array of features included in the plan",
      },

      status: {
        type: DataTypes.ENUM("Active", "Inactive"),
        defaultValue: "Active",
        comment: "Plan status",
      },
    },
    {
      tableName: "plans",
      timestamps: true,
      indexes: [{ fields: ["status"] }, { fields: ["name"] }],
    }
  );

  // 🔗 Associations
  Plan.associate = (models) => {
    Plan.hasMany(models.Subscription, {
      foreignKey: "planId",
      as: "subscriptions",
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  };

  return Plan;
};
