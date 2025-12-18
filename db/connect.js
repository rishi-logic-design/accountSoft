const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT || "mysql",
    timezone: "+05:30",
    logging: false,

    // SSL 
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },

    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 5,
      min: parseInt(process.env.DB_POOL_MIN) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
    },
  }
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL Database connected successfully...");
  } catch (err) {
    console.error("❌ Database connection failed!");
    console.error("Reason:", err.message);
    process.exit(1);
  }
})();

module.exports = { sequelize, Sequelize };
