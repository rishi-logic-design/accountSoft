// models/customerOtp.model.js
module.exports = (sequelize, DataTypes) => {
  const CustomerOtp = sequelize.define(
    "CustomerOtp",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      customerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // optional link if known
      mobileNumber: { type: DataTypes.STRING, allowNull: false },
      otp: { type: DataTypes.STRING, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      used: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    {
      tableName: "customer_otps",
      timestamps: true,
      indexes: [{ fields: ["mobileNumber"] }],
    }
  );

  return CustomerOtp;
};
