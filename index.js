import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import exifr from 'exifr';

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Konfigurasi multer untuk menyimpan file di folder 'uploads'
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const extname = path.extname(file.originalname);
        const timestamp = Date.now();
        cb(null, `${timestamp}${extname}`);
    },
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.render('main');
});

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No files were uploaded.');
    }

    const file = req.file;

    // Read file buffer
    const buffer = await fs.promises.readFile(file.path);

    // Read metadata using exifr
    const metadata = await readMetadata(buffer);

    // Encrypt metadata
    const key = req.body.key; // Symmetric key from user input
    const encryptedMetadata = encryptMetadata(metadata, key);
    console.log(metadata)
    // Display encrypted metadata on the console (for testing purposes)
    console.log('Encrypted Metadata:', encryptedMetadata);

    // Decrypt metadata
    const decryptedMetadata = decryptMetadata(encryptedMetadata, key);

    // Display decrypted metadata on the console (for testing purposes)
    console.log('Decrypted Metadata:', decryptedMetadata);

    // Send a response to the client
    res.send('File uploaded successfully!');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

async function readMetadata(buffer) {
    try {
        const metadata = await exifr.parse(buffer);
        return metadata;
    } catch (error) {
        console.error('Error reading metadata:', error.message);
        return {};
    }
}

function encryptMetadata(metadata, key) {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encryptedMetadata = cipher.update(JSON.stringify(metadata), 'utf-8', 'hex');
    encryptedMetadata += cipher.final('hex');
    return encryptedMetadata;
}

function decryptMetadata(encryptedMetadata, key) {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decryptedMetadata = decipher.update(encryptedMetadata, 'hex', 'utf-8');
    decryptedMetadata += decipher.final('utf-8');
    return JSON.parse(decryptedMetadata);
}
