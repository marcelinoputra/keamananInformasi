import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import exifr from 'exifr';
import piexif from 'piexifjs';

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(express.static('public'));

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

async function readMetadata(buffer) {
    try {
        const metadata = await exifr.parse(buffer);
        return metadata || {};
    } catch (error) {
        console.error('Error reading metadata:', error.message);
        return {};
    }
}

function encryptMetadata(metadata, key) {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encryptedMetadata = cipher.update(JSON.stringify(metadata), 'utf-8', 'hex');
    encryptedMetadata += cipher.final('hex');
    // console.log(encryptedMetadata)
    return encryptedMetadata;
}

function writeMetadataToFile(filePath, metadata) {
    if (!metadata ){
        console.log("hehe");
        
    }
    // Ensure the metadata has necessary properties
    if (!metadata || !metadata["0th"]) {
        console.error('Invalid metadata structure.');
        return;
    }

    const exifStr = piexif.dump(metadata);
    
    try {
        if (!exifStr) {
            console.error('Error dumping metadata.');
            return;
        }

        const data = piexif.insert(exifStr, fs.readFileSync(filePath));
        fs.writeFileSync(filePath, data);
        return data;
    } catch (error) {
        console.error('Error writing metadata to file:', error.message);
    }
}


const getDirname = (importMetaUrl) => {
    const currentModuleURL = new URL(importMetaUrl);
    return path.dirname(fileURLToPath(currentModuleURL));
}
import { fileURLToPath } from 'url';
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No files were uploaded.');
    }

    const file = req.file;
    const dirname = getDirname(import.meta.url);

    const filePath = path.join(dirname, 'uploads', file.filename);
    // Read file buffer
    const buffer = await fs.promises.readFile(file.path);

    // Read existing metadata
    const existingMetadata = await readMetadata(buffer);

    // Encrypt metadata
    const key = req.body.key;
    const encryptedMetadata = encryptMetadata(existingMetadata, key);

    // console.log("Encrypted Metadata: " + encryptedMetadata);
    // console.log ("ini file path --> " + filePath)

    // Write encrypted metadata to the file
    await writeMetadataToFile(filePath, { UserComment: encryptedMetadata });

    // Send the updated file as a response for download
    await new Promise(resolve => {
        res.download(file.path, file.originalname, (err) => {
            if (err) {
                console.error('Error downloading file:', err.message);
            } else {
                console.log('File downloaded successfully!');
            }

            // Cleanup: remove the temporary file after download
            fs.unlinkSync(file.path);

            resolve();
        });
    });
});


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
