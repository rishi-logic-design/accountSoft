const serviceService = require("../../services/vendor/serviceService");

exports.createService = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await serviceService.createService(vendorId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.listServices = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const { search, page, size } = req.query;
    const result = await serviceService.listServices(vendorId, {
      search,
      page,
      size,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getServiceById = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await serviceService.getServiceById(req.params.id, vendorId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const vendorId = req.user.id;
    const result = await serviceService.updateService(
      req.params.id,
      vendorId,
      req.body,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const vendorId = req.user.id;
    await serviceService.deleteService(req.params.id, vendorId);
    res
      .status(200)
      .json({ success: true, message: "Service deleted successfully" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
