const accountService = require("../../services/vendor/accountService");

exports.getAccounts = async (req, res) => {
  try {
    const { accountType, search } = req.query;
    const vendorId = req.user.id;
    const accounts = await accountService.getAccountList(vendorId, {
      accountType,
      search,
    });
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const account = await accountService.createAccount(vendorId, req.body);
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    const account = await accountService.updateAccount(vendorId, id, req.body);
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    await accountService.deleteAccount(vendorId, id);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.adjustBalance = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await accountService.adjustBalance(vendorId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.contraEntry = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await accountService.createContraEntry(vendorId, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAccountLedger = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { id } = req.params;
    const { fromDate, toDate, search } = req.query;
    const ledger = await accountService.getAccountLedger(vendorId, id, {
      fromDate,
      toDate,
      search,
    });
    res.json({ success: true, data: ledger });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
