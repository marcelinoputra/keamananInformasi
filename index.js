import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import exifr from 'exifr';

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

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No files were uploaded.');
    }

    const file = req.file;
    const fileName = `${path.parse(file.originalname).name}.encrypted`;
    const filePath = path.join(__dirname, 'uploads', fileName);

    // Read file buffer
    const buffer = Buffer.from(file.buffer);

    // Read metadata using exifr
    const metadata = await readMetadata(buffer);

    // Display metadata on the console (for testing purposes)
    console.log(metadata);

    // Encrypt file metadata using RSA
    const privateKey = crypto.createPrivateKey({
        key: `-----BEGIN PRIVATE KEY-----
        MIIEpAIBAAKCAQEAwRmM99x14V4g8wStxQaaI0qEh/9NSx8M8z/X5xV6gTWTdnDD
        ... (Kunci RSA Anda) ...
        GjswRpt13L2AzhzUd5GucdjNwT3aID3U9s5pT4e2zwnbYLRaK6Jrf4rgu3lppLCx
        a49amv8hoBcKYDpLuIeVpsKY69s7YwQnURv7EH/... (Kunci RSA Anda) ...
        -----END PRIVATE KEY-----`,
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

async function readMetadata(buffer) {
    try {
        const metadata = await exifr.parse(buffer);
        return metadata;
    } catch (error) {
        console.error('Error reading metadata:', error.message);
        return {};
    }
}
