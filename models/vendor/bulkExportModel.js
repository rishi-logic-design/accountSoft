module.exports = (sequelize, DataTypes) => {
  const BulkExport = sequelize.define(
    "BulkExport",
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
      documentType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fromDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      toDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("Pending", "Generated", "Failed"),
        defaultValue: "Generated",
      },
      requestedOn: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      fileUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "bulk_exports",
      timestamps: true,
    },
  );

  return BulkExport;
};
