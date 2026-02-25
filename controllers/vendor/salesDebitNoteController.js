const salesDebitNoteService = require("../../services/vendor/salesDebitNoteService");

exports.createSalesDebitNote = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await salesDebitNoteService.createSalesDebitNote(
      vendorId,
      req.body,
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.listSalesDebitNotes = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const {
      page,
      size,
      search,
      fromDate,
      toDate,
      status,
      customerId,
      sortBy,
      sortOrder,
    } = req.query;
    const result = await salesDebitNoteService.listSalesDebitNotes({
      vendorId,
      customerId,
      page,
      size,
      search,
      fromDate,
      toDate,
      status,
      sortBy,
      sortOrder,
    });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSalesDebitNoteById = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await salesDebitNoteService.getSalesDebitNoteById(
      req.params.id,
      vendorId,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateSalesDebitNote = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await salesDebitNoteService.updateSalesDebitNote(
      req.params.id,
      vendorId,
      req.body,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteSalesDebitNote = async (req, res) => {
  try {
    const vendorId = req.user.id;
    await salesDebitNoteService.deleteSalesDebitNote(req.params.id, vendorId);
    res.status(200).json({
      success: true,
      message: "Sales Debit Note deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
