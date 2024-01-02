import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import exifr from "exifr";
import piexif from "piexifjs";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.use(express.static("public"));

// Konfigurasi multer untuk menyimpan file di folder 'uploads'
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const extname = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `${timestamp}${extname}`);
  },
});

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
  res.render("main");
});
const getDirname = (importMetaUrl) => {
  const currentModuleURL = new URL(importMetaUrl);
  return path.dirname(fileURLToPath(currentModuleURL));
};
import { fileURLToPath } from "url";

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No files were uploaded.");
  }

  const file = req.file;
  const dirname = getDirname(import.meta.url);

  const filePath = path.join(dirname, "uploads", file.filename);

  // Read file buffer
  const buffer = await fs.promises.readFile(file.path);

  // Read metadata using exifr
  const metadata = await readMetadata(buffer);
  // Encrypt metadata
  const key = req.body.key; // Symmetric key from user input
  const encryptedMetadata = encryptMetadata(metadata, key);
  // console.log(metadata);
  // Display encrypted metadata on the console (for testing purposes)
  // console.log('Encrypted Metadata:', encryptedMetadata);

  // Update the metadata of the file with encrypted metadata
  const updatedFilePath = path.join("uploads/", `encrypted_${file.filename}`);
  await updateFileMetadata(file.path, encryptedMetadata);

  // Send a response to the client
  res.send("File uploaded and metadata updated successfully!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

async function readMetadata(buffer) {
  try {
    const metadata = await exifr.parse(buffer);
    return metadata;
  } catch (error) {
    console.error("Error reading metadata:", error.message);
    return {};
  }
}

function encryptMetadata(metadata, key) {
  const cipher = crypto.createCipher("aes-256-cbc", key);
  let encryptedMetadata = cipher.update(
    JSON.stringify(metadata),
    "utf-8",
    "hex"
  );
  encryptedMetadata += cipher.final("hex");
  return encryptedMetadata;
}

function decryptMetadata(encryptedMetadata, key) {
  const decipher = crypto.createDecipher("aes-256-cbc", key);
  let decryptedMetadata = decipher.update(encryptedMetadata, "hex", "utf-8");
  decryptedMetadata += decipher.final("utf-8");
  return JSON.parse(decryptedMetadata);
}
import imageType from 'image-type';

// const imageType = require('image-type');
async function updateFileMetadata(updatedFilePath, encryptedMetadata) {
  try {
    let imageData = fs.readFileSync(updatedFilePath);
    let type = imageType(imageData);
    if (type && type.ext === "jpg") {
        // ...
      } else {
          const newFilePath = changeFileExtension(updatedFilePath, 'jpg');
  
          // Log the change
          console.log(`Changed image extension to jpg: ${newFilePath}`);
    
          // Update the file path for further processing
          updatedFilePath = newFilePath;
          
      }
    
      imageData = fs.readFileSync(updatedFilePath);
     type = imageType(imageData);

    const existingMetadataBeforeRemoval = await readMetadata(imageData);
    console.log("Existing Metadata Before Removal:", existingMetadataBeforeRemoval);
    
    // Log the image data for debugging
    // console.log("Image Data:", imageData);
    
      // Check image format
    const newExif = {
        Make: { encryptedMetadata },
        thumbnail: null,
      }
      const newExifStr = piexif.dump(newExif);

   
    console.log(imageData)
    


    const updatedData = piexif.insert(newExifStr, imageData);
    console.log("hehe")

    // TODO bukan JPG atau JPEG katanya
    

    fs.writeFileSync(updatedFilePath, updatedData);
    // Log the updated metadata
    const updatedMetadata = await readMetadata(
      fs.readFileSync(updatedFilePath)
    );
    console.log(
      "Metadata updated successfully. Updated Metadata:",
      updatedMetadata
    );

    console.log("yay");
  } catch (error) {
    console.error("Error updating metadata:", error.message);
  }
}
function changeFileExtension(filePath, newExtension) {
    const extname = path.extname(filePath);
    const basename = path.basename(filePath, extname);
    return path.join(path.dirname(filePath), `${basename}.${newExtension}`);
  }