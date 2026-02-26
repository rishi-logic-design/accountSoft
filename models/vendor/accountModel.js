module.exports = (sequelize, DataTypes) => {
  const Account = sequelize.define(
    "Account",
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
      accountType: {
        type: DataTypes.ENUM("CASH", "BANK", "OTHER"),
        allowNull: false,
      },
      accountName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Bank specific fields
      accountHolderName: {
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
      branchName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ibanNumber: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      swiftCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      openingBalance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      openingBalanceDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      status: {
        type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    {
      tableName: "accounts",
      timestamps: true,
      indexes: [
        { fields: ["vendorId"] },
        { fields: ["accountType"] },
        { fields: ["status"] },
      ],
    },
  );

  return Account;
};
