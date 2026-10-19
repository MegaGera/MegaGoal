/**
 * Proxies profile picture uploads to MegaMedia so the browser stays on MegaGoal,
 * then stores the relative path on the MegaGoal users document.
 */
import path from 'node:path';
import multer from 'multer';
import FormData from 'form-data';
import axios from 'axios';
import { getDB } from '../config/db.js';
import { logProfilePictureChanged } from './logController.js';
import {
  buildNewUserDocument,
  buildUserMeResponse,
  parseUserDocument
} from '../entities/userEntity.js';

const PROFILE_UPLOAD_PATH = '/api/megagoal/user/profile/image/';
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

export const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error('Unsupported file type. Use png, jpg, or webp.'));
      return;
    }
    cb(null, true);
  }
}).single('image');

function megamediaBaseUrl() {
  const raw = process.env.MEGAMEDIA_URL || 'https://server.megamedia.megagera.com';
  return String(raw).replace(/\/+$/, '');
}

function responseLooksLikeHTML(s) {
  const t = String(s).trimStart().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

export const uploadProfilePicture = async (req, res) => {
  try {
    const username = req.validateData?.username;
    if (!username) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({
        message: 'Missing image file (multipart field "image")'
      });
    }

    const base = megamediaBaseUrl();
    const uploadUrl =
      `${base}${PROFILE_UPLOAD_PATH}` +
      `?username=${encodeURIComponent(String(username))}`;

    const form = new FormData();
    form.append('username', String(username));

    let filename = path.basename(file.originalname || '') || 'profile';
    if (!path.extname(filename)) {
      const extByMime = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp'
      };
      filename += extByMime[file.mimetype] || '.jpg';
    }

    form.append('image', file.buffer, {
      filename,
      contentType: file.mimetype || 'application/octet-stream'
    });

    const token = req.cookies?.access_token;

    let megaRes;
    try {
      megaRes = await axios.post(uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          ...(token ? { Cookie: `access_token=${token}` } : {})
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true
      });
    } catch (err) {
      console.error('MegaMedia profile upload request error:', err);
      return res.status(502).json({ message: 'Could not reach MegaMedia' });
    }

    const status = megaRes.status;
    let text = '';
    if (typeof megaRes.data === 'string') {
      text = megaRes.data;
    } else if (Buffer.isBuffer(megaRes.data)) {
      text = megaRes.data.toString('utf8');
    } else if (megaRes.data != null) {
      text = JSON.stringify(megaRes.data);
    }

    if (responseLooksLikeHTML(text)) {
      console.warn('[profile-picture] HTML response from MegaMedia — check MEGAMEDIA_URL', {
        uploadUrl,
        status
      });
      return res.status(502).json({
        message:
          'MegaMedia returned a web page instead of the API. Set MEGAMEDIA_URL to the Go MegaMedia API base URL.'
      });
    }

    if (status !== 200) {
      const outStatus = status >= 400 && status < 600 ? status : 502;
      return res.status(outStatus).json({
        message:
          text.length > 0 && text.length < 800
            ? text.trim()
            : text.slice(0, 500).trim() || 'MegaMedia upload failed'
      });
    }

    let json;
    if (typeof megaRes.data === 'object' && megaRes.data !== null) {
      json = megaRes.data;
    } else {
      try {
        json = JSON.parse(text);
      } catch {
        return res.status(502).json({ message: 'Invalid JSON from MegaMedia' });
      }
    }

    const relativePath = json.path;
    if (typeof relativePath !== 'string' || !relativePath.startsWith('users/')) {
      return res.status(502).json({ message: 'MegaMedia returned an unexpected payload' });
    }

    const db = getDB();
    await db.collection('users').findOneAndUpdate(
      { username },
      { $setOnInsert: buildNewUserDocument({ username }) },
      { upsert: true, returnDocument: 'after' }
    );

    const updatedOn = new Date();
    const after = await db.collection('users').findOneAndUpdate(
      { username },
      {
        $set: {
          profilePicture: {
            path: relativePath,
            updatedOn
          }
        }
      },
      { returnDocument: 'after' }
    );

    if (!after) {
      return res.status(500).json({ message: 'Failed to update user profile picture' });
    }

    const validated = parseUserDocument(after);
    await logProfilePictureChanged(username, relativePath, req);

    return res.send(buildUserMeResponse(validated));
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    if (error.message?.includes('Unsupported file type')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image too large (max 10MB)' });
    }
    return res.status(500).json({ message: error.message || 'Upload failed' });
  }
};
