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

  try {
    // Read file buffer
    const buffer = await fs.promises.readFile(file.path);

    // Read metadata using exifr
    const metadata = await exifr.parse(buffer);
    const exifData = await readMetadataUsingPiexifjs(buffer);

    // Empty metadata
    const emptyExifData = { "0th": {}, "Exif": {}, "GPS": {} };

    // Insert empty metadata into the image
    const newExifData = piexif.insert(piexif.dump(emptyExifData), buffer.toString("binary"));
    const newJpeg = Buffer.from(newExifData, "binary");

    // Write the modified file
    fs.writeFileSync(filePath, newJpeg);

    // Create a download link for the user
    const downloadLink = `/download/${file.filename}`;

    // Encrypt metadata
    const key = req.body.key; // Symmetric key from user input
    const encryptedMetadata = encryptMetadata(metadata, key);

    // Optionally, you can render the display page after sending the file
    res.render("display", {
      metadata: metadata,
      encryptedText: encryptedMetadata,
      imageBuffer: buffer.toString("base64"),
      key: key,
      filename: file.filename,
      imageData : buffer,
      downloadLink: downloadLink,
    });
  } catch (error) {
    console.error("Error processing the uploaded file:", error.message);
    res.status(500).send("Internal Server Error");
  }
  // } finally {
  //   // Clean up: Delete the temporary file
  //   await fs.promises.unlink(file.path);
  // }
});

app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const dirname = getDirname(import.meta.url);
  const filepath = path.join(dirname, "uploads", filename);

  if (fs.existsSync(filepath)) {
    res.download(filepath, (err) => {
      if (err) {
        console.error("Error downloading file:", err.message);
        res.status(500).send("Internal Server Error");
      }
    });
  } else {
    res.status(404).send("File not found");
  }
});

function decryptMetadata(encryptedMetadata, key) {
  try {
    const decipher = crypto.createDecipher("aes-256-cbc", key);

    // Use 'base64' encoding for the update method
    let decryptedMetadata = decipher.update(encryptedMetadata, "hex", "utf-8");

    decryptedMetadata += decipher.final("utf-8");

    return JSON.parse(decryptedMetadata);
  } catch (error) {
    console.error('Error during decryption:', error.message);
    return null;
  }
}

app.post('/decrypt', (req, res) => {
  try {
    // Extract encrypted content and key from the POST request body
    const { encryptedContent, key } = req.body;

    // Check if both encrypted content and key are provided
    if (!encryptedContent || !key) {
      return res.status(400).json({ error: 'Both encryptedContent and key are required.' });
    }

    // Decrypt the metadata using the provided function
    const decryptedMetadata = decryptMetadata(encryptedContent, key);

    // Render the decrypted metadata on the 'decrypted.ejs' template
    res.render('decrypted', { decryptedMetadata });

  } catch (error) {
    console.error('Error decrypting metadata:', error.message);
    res.status(500).send('Error decrypting metadata. Check the console for details.');
  }
});
  
app.post("/decrypt", (req, res) => {
  const { encryptedContent, key } = req.body;
  res.redirect(`/decrypted?encryptedContent=${encodeURIComponent(encryptedContent)}&key=${encodeURIComponent(key)}`);
});
app.get("/decrypted", (req, res) => {
  const encryptedContent = req.query.encryptedContent;
  const key = req.query.key;

  // Decrypt the metadata using the provided function
  const decryptedMetadata = decryptMetadata(encryptedContent, key);

  // Render the 'decrypted.ejs' template with decrypted metadata and key
  res.render("decrypted", { decryptedMetadata, key });
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

async function readMetadataUsingPiexifjs(buffer) {
  try {
      const metadata = await piexif.load(buffer.toString("binary"));
      return metadata || {};
  } catch (error) {
      console.error('Error reading metadata:', error.message);
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
    
    // Check image format
    const newExif = {
        Make: { encryptedMetadata },
        thumbnail: null,
    };
    const newExifStr = piexif.dump(newExif);

    const updatedData = piexif.insert(newExifStr, imageData);

    fs.writeFileSync(updatedFilePath, updatedData);

    const updatedMetadata = await readMetadata(
      fs.readFileSync(updatedFilePath)
    );
    console.log(
      "Metadata updated successfully. Updated Metadata:",
      updatedMetadata
    );
  } catch (error) {
    console.error("Error updating metadata:", error.message);
  }
}

function changeFileExtension(filePath, newExtension) {
    const extname = path.extname(filePath);
    const basename = path.basename(filePath, extname);
    return path.join(path.dirname(filePath), `${basename}.${newExtension}`);
}



app.get("/", (req, res) => {
  res.render("main");
});

app.post("/choose", (req, res) => {
  const choice = req.body.choice;

  if (choice === "encrypt") {
    // Redirect to the page for encrypting from photo file
    res.redirect("/encrypt");
  } else if (choice === "decrypt") {
    // Redirect to the page for decrypting from TXT file
    res.redirect("/decrypt");
  } else {
    // Handle invalid choices (optional)
    res.status(400).send("Invalid choice");
  }
});

app.get("/encrypt", (req, res) => {
  res.render("encrypt");
});

app.get("/decrypt", (req, res) => {
  res.render("decrypt");
});

