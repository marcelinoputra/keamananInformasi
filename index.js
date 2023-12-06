import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sizeOf from 'image-size';
import ExifParser from 'exif-parser';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Setup Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.render('main');
});

app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No files were uploaded.');
    }

    const file = req.file;
    const fileName = `${path.parse(file.originalname).name}.encrypted`;
    const filePath = path.join(__dirname, 'uploads', fileName);

    // Read file buffer
    const buffer = Buffer.from(file.buffer);

    // Extract EXIF data
    const exifData = extractExifData(buffer);

    // Get image dimensions and additional metadata
    const dimensions = sizeOf(buffer); // Extracts width and height
    
    const metadata = {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        encoding: file.encoding,   // Additional metadata
        fieldname: file.fieldname, // Additional metadata
        // Add more properties as needed
        width: dimensions.width, // Additional metadata
        height: dimensions.height, // Additional metadata
        author: exifData.Author || 'Unknown Author' // Additional metadata
         // Additional metadata
    };
    console.log(metadata);
    // Encrypt file metadata using RSA
    const privateKey = crypto.createPrivateKey({
        key: `-----BEGIN RSA PRIVATE KEY-----
        MIIBOgIBAAJBAJh2JRwQiNrNX/cLyUdI0dY/YmCkTdGXRsAHcL+BxR/NiBJw
        aBHqbG3kW2sXFYWnjI3UCAwEAAQJBAMZ8aYtEHtIpKW8yEaR/MqgRaJOOc3
        wGYZwP20aWoAqN0CgMVyDj/PdOzVdBN/FtVHZhfWqNpZWOqJJAgMBAAEC
        -----END RSA PRIVATE KEY-----`,
        format: 'pem',
        type: 'pkcs8'
    });



    const encryptedMetadata = crypto.privateEncrypt(
        { key: privateKey, padding: crypto.constants.RSA_NO_PADDING },
        Buffer.from(JSON.stringify(metadata))
    );

    // Save the encrypted image
    fs.writeFile(filePath, Buffer.concat([encryptedMetadata, buffer]), (err) => {
        if (err) {
            return res.status(500).send(err);
        }

        res.render('download', {
            fileName,
            filePath: `/uploads/${fileName}`
        });
    });
});


app.get('/uploads/:fileName', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.fileName);
    res.download(filePath);
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

function extractExifData(buffer) {
    try {
        const parser = ExifParser.create(buffer);
        const result = parser.parse();
        return result.tags || {};
    } catch (error) {
        console.error('Error extracting EXIF data:', error.message);
        return {};
    }
}