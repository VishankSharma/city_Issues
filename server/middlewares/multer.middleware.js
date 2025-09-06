import path from "path";
import multer from "multer";

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "uploads"); // folder where files will be saved
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); // unique filename
  },
});

// File filter to allow only images/videos
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (![".jpg", ".jpeg", ".png", ".webp", ".mp4"].includes(ext)) {
    cb(new Error(`Only image and video files are allowed! (${ext})`), false);
    return;
  }
  cb(null, true);
};

// Multer upload instance
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 50 MB
  fileFilter,
});

export default upload;
