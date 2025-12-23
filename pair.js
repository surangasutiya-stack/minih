const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require('yt-search');
const fetch = require('node-fetch');
const os = require('os');
const ddownr = require('denethdev-ytmp3');

// External Dependencies for song1
let ytdlChama = null;
try { ytdlChama = require('ytdl-chama'); } catch (e) { ytdlChama = null; }
let ytdlCore, ffmpeg;
try { ytdlCore = require('ytdl-core'); } catch(e) { ytdlCore = null; }
try { ffmpeg = require('fluent-ffmpeg'); } catch(e) { ffmpeg = null; }
try { 
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpeg && ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);
} catch(e) {}

const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');

//=======================================
const autoReact = getSetting('AUTO_REACT') || 'off';

//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');

//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/B9HqRViG3g91f76iNx50L3?mode=ems_copy_t',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://i.ibb.co/Kjq97rcG/3575.jpg',
    NEWSLETTER_JID: '120363395674230271@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    BOT_NAME: 'NECO-MINI BOT',
    OWNER_NAME: '@Hashuu',
    OWNER_NUMBER: '94716042889',
    BOT_FOOTER: '> © POWERED BY NECO MINI',
    BUTTON_IMAGES: {
        ALIVE: 'https://i.ibb.co/Kjq97rcG/3575.jpg',
        MENU: 'https://i.ibb.co/Kjq97rcG/3575.jpg'
    }
};

const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const mongoUri = 'mongodb+srv://mrshrii404:JLtbz0CEOC1u6CwS@shri.gkhohrr.mongodb.net/';
const client = new MongoClient(mongoUri);
let db;

async function initMongo() {
    if (!db) {
        await client.connect();
        db = client.db('KelumXz');
        await db.collection('sessions').createIndex({ number: 1 });
    }
    return db;
}

// Utility Functions
function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

function runtime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + "d " : ""}${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
}

// Global Variables
const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

// Helper Functions
async function joinGroup(socket) {
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) return { status: 'failed', error: 'Invalid link' };
    try {
        const response = await socket.groupAcceptInvite(inviteCodeMatch[1]);
        return { status: 'success', gid: response };
    } catch (e) { return { status: 'failed', error: e.message }; }
}

// Core Handlers
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
        if (text.startsWith(config.PREFIX)) {
            const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
            command = parts[0].toLowerCase();
            args = parts.slice(1);
        }

        if (!command) return;

        try {
            switch (command) {
                case 'menu': {
                    const uptime = runtime(process.uptime());
                    const title = '┏━❐  `H E L L O W`\n┃ *⭔ Itz:* NECO-MINI\n┃ *⭔ UpTime:* ' + uptime + '\n┗━❐';
                    const content = `*© NECO-MINI*\n\n*Commands:* song, video, fb, ig, song1, pair, ping, alive`;
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.MENU },
                        caption: formatMessage(title, content, config.BOT_FOOTER)
                    }, { quoted: msg });
                    break;
                }

                case 'ping': {
                    const start = Date.now();
                    await socket.sendMessage(sender, { text: 'Testing Ping...' });
                    const end = Date.now();
                    await socket.sendMessage(sender, { text: `🚀 Pong: ${end - start}ms` }, { quoted: msg });
                    break;
                }

                case 'alive': {
                    await socket.sendMessage(sender, {
                        image: { url: config.BUTTON_IMAGES.ALIVE },
                        caption: `*NECO-MINI IS ONLINE* ✅\n\nRuntime: ${runtime(process.uptime())}`
                    }, { quoted: msg });
                    break;
                }

                case 'song1': {
                    const q = args.join(" ").trim();
                    if (!q) return socket.sendMessage(sender, { text: '*`Need YT_URL or Title`*' });

                    await socket.sendMessage(sender, { react: { text: '🔎', key: msg.key } });

                    let videoUrl = q;
                    if (!q.match(/(youtube\.com|youtu\.be)/)) {
                        const search = await yts(q);
                        if (!search.videos.length) return socket.sendMessage(sender, { text: '❌ No results found' });
                        videoUrl = search.videos[0].url;
                    }

                    let mp3Info = null;
                    if (ytdlChama) {
                        try {
                            if (typeof ytdlChama === 'function') mp3Info = await ytdlChama(videoUrl);
                            else if (ytdlChama.getMP3) mp3Info = await ytdlChama.getMP3(videoUrl);
                        } catch (e) { mp3Info = null; }
                    }

                    const downloadUrl = mp3Info?.downloadUrl || mp3Info?.url;
                    if (downloadUrl) {
                        const caption = `🎵 *Title:* ${mp3Info?.title || 'Song'}\n\n*Reply with:*\n1. Document\n2. Audio\n3. Voice Note`;
                        const resMsg = await socket.sendMessage(sender, { image: { url: mp3Info?.thumbnail || config.IMAGE_PATH }, caption }, { quoted: msg });

                        const handler = async (mUpdate) => {
                            const rec = mUpdate.messages[0];
                            if (!rec.message) return;
                            const t = rec.message.conversation || rec.message.extendedTextMessage?.text;
                            if (rec.message.extendedTextMessage?.contextInfo?.stanzaId === resMsg.key.id) {
                                if (t === '1') await socket.sendMessage(sender, { document: { url: downloadUrl }, mimetype: 'audio/mpeg', fileName: 'song.mp3' }, { quoted: rec });
                                else if (t === '2') await socket.sendMessage(sender, { audio: { url: downloadUrl }, mimetype: 'audio/mpeg' }, { quoted: rec });
                                else if (t === '3') await socket.sendMessage(sender, { audio: { url: downloadUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: rec });
                                socket.ev.off('messages.upsert', handler);
                            }
                        };
                        socket.ev.on('messages.upsert', handler);
                        setTimeout(() => socket.ev.off('messages.upsert', handler), 120000);
                    } else {
                        await socket.sendMessage(sender, { text: '❌ Failed to fetch audio.' });
                    }
                    break;
                }

                case 'fb': {
                    const fbUrl = args[0];
                    if (!fbUrl) return socket.sendMessage(sender, { text: 'Link please!' });
                    try {
                        const res = await axios.get(`https://api.nekolabs.my.id/downloader/facebook?url=${encodeURIComponent(fbUrl)}`);
                        const media = res.data.result.medias[0];
                        await socket.sendMessage(sender, { video: { url: media.url }, caption: '✅ FB Download' }, { quoted: msg });
                    } catch (e) { socket.sendMessage(sender, { text: 'Error!' }); }
                    break;
                }

                case 'pair': {
                    const num = args[0];
                    if (!num) return socket.sendMessage(sender, { text: 'Usage: .pair 9471...' });
                    const pairUrl = `https://zeus-mini-079bc98a7e44.herokuapp.com/code?number=${num}`;
                    const res = await (await fetch(pairUrl)).json();
                    await socket.sendMessage(sender, { text: `✅ Your Code: *${res.code}*` }, { quoted: msg });
                    break;
                }
            }
        } catch (e) { console.log(e); }
    });
}

// Socket Initialization
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const socket = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })) },
        printQRInTerminal: false,
        browser: Browsers.macOS('Safari')
    });

    setupCommandHandlers(socket, sanitizedNumber);

    socket.ev.on('creds.update', saveCreds);

    if (!socket.authState.creds.registered) {
        const code = await socket.requestPairingCode(sanitizedNumber);
        if (!res.headersSent) res.send({ code });
    } else {
        if (!res.headersSent) res.send({ status: 'connected' });
    }

    socket.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            activeSockets.set(sanitizedNumber, socket);
            console.log(`Connected: ${sanitizedNumber}`);
        }
    });
}

// Express Routes
router.get('/', async (req, res) => {
    if (!req.query.number) return res.status(400).send({ error: 'No number' });
    await EmpirePair(req.query.number, res);
});

router.get('/ping', (req, res) => res.send({ status: 'active' }));

module.exports = router;
