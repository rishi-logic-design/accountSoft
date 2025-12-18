exports.whatsappLink = (mobile, text) => {
  const phone = mobile.replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${phone}?text=${encoded}`;
};
