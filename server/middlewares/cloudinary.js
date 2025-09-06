import cloudinary from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Cloudinary configuration
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload function
const uploads = (file, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.v2.uploader.upload(
      file,
      {
        resource_type: "auto",
        folder: folder,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          secure_url: result.secure_url, 
          public_id: result.public_id,     
        });
      }
    );
  });
};

// ✅ export both default and named
export default cloudinary.v2;
export { uploads };
