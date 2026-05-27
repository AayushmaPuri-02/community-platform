const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "community-platform-profiles",
    allowed_formats: ["png", "jpg", "jpeg", "webp"],
  },
});

const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'community-platform-docs',
    resource_type: 'auto',   // ✅ THIS IS THE FIX
    allowed_formats: ['pdf', 'jpg', 'jpeg', 'png'],
  }
});
console.log(process.env.CLOUD_API_KEY);
module.exports = { cloudinary, documentStorage,imageStorage };