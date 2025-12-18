module.exports = (sequelize, DataTypes) => {
  const Size = sequelize.define(
    "Size",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      label: { type: DataTypes.STRING, allowNull: false },
      inches: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
    },
    {
      tableName: "sizes",
      timestamps: true,
      indexes: [{ unique: true, fields: ["label"] }],
    }
  );

  return Size;
};
