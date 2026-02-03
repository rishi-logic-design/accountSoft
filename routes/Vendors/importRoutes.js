const express = require("express");
const multer = require("multer");
const auth = require("../../middleware/authMiddleware");
const importController = require("../../controllers/vendor/importController");
const exportController = require("../../controllers/vendor/exportController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "application/json" ||
      file.originalname.endsWith(".json")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JSON files are allowed"));
    }
  },
});

const increaseTimeout = (req, res, next) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
};

router.post(
  "/import/json",
  auth,
  increaseTimeout,
  upload.single("file"),
  (req, res, next) => {
    importController.importJson(req, res, next);
  },
);

router.get("/json", auth, increaseTimeout, exportController.exportJson);

module.exports = router;
