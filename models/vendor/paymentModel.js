module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    "Payment",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      paymentNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      vendorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      customerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM("inward", "outward"),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      method: {
        type: DataTypes.ENUM("cash", "bank", "cheque", "online", "other"),
        allowNull: false,
        defaultValue: "cash",
      },
      reference: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachments: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      billId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      challanId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      accountNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ifscCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      upiId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "cancelled"),
        allowNull: false,
        defaultValue: "completed",
      },
    },
    {
      tableName: "payments",
      timestamps: true,
      paranoid: true,
    }
  );

  return Payment;
};
