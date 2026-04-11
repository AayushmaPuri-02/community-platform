const multer = require("multer");
const { imageStorage, documentStorage } = require("../cloudConfig");

const allowedImageMimeTypes = ["image/jpeg", "image/png", "image/jpg"];

const imageFileFilter = (req, file, cb) => {
  if (allowedImageMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error("Only JPG, JPEG, and PNG image files are allowed");
    error.code = "INVALID_IMAGE_TYPE";
    cb(error);
  }
};

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 1.5 * 1024 * 1024,
  },
  fileFilter: imageFileFilter,
});

const uploadDocument = multer({
  storage: documentStorage,
});

module.exports = { uploadImage, uploadDocument };