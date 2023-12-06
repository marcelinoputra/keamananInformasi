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
