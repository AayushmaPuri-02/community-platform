const multer = require("multer");
const { imageStorage, documentStorage } = require("../cloudConfig");

const uploadImage = multer({ storage: imageStorage });
const uploadDocument = multer({ storage: documentStorage });

module.exports = { uploadImage, uploadDocument };