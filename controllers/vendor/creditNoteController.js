const creditNoteService = require("../../services/vendor/creditNoteService");

exports.createCreditNote = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await creditNoteService.createCreditNote(vendorId, req.body);
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

exports.listCreditNotes = async (req, res) => {
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
    const result = await creditNoteService.listCreditNotes({
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

exports.getCreditNoteById = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await creditNoteService.getCreditNoteById(
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

exports.deleteCreditNote = async (req, res) => {
  try {
    const vendorId = req.user.id;
    await creditNoteService.deleteCreditNote(req.params.id, vendorId);
    res.status(200).json({
      success: true,
      message: "Credit Note deleted successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
