"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.touchDevice = exports.linkDeviceToCoach = exports.createCoachProfile = void 0;
const node_crypto_1 = require("node:crypto");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const options_1 = require("firebase-functions/v2/options");
(0, options_1.setGlobalOptions)({ region: 'europe-west2' });
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
const PIN_PATTERN = /^\d{4}$/;
const PIN_ITERATIONS = 150000;
const PIN_ALGO = 'pbkdf2-sha256';
const PIN_DIGEST = 'sha256';
const PIN_KEYLEN = 32;
function requireAuthUid(uid) {
    if (!uid)
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    return uid;
}
function cleanName(name, label) {
    const value = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
    if (!value)
        throw new https_1.HttpsError('invalid-argument', `${label} is required.`);
    if (value.length > 80)
        throw new https_1.HttpsError('invalid-argument', `${label} is too long.`);
    return value;
}
function normalizeNamePart(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}
function toNameKey(firstName, lastName) {
    return `${normalizeNamePart(firstName)}|${normalizeNamePart(lastName)}`;
}
function cleanPin(pin) {
    const value = typeof pin === 'string' ? pin.trim() : '';
    if (!PIN_PATTERN.test(value)) {
        throw new https_1.HttpsError('invalid-argument', 'PIN must be exactly 4 digits.');
    }
    return value;
}
function cleanDeviceLabel(label) {
    if (label === undefined || label === null || label === '')
        return undefined;
    if (typeof label !== 'string')
        throw new https_1.HttpsError('invalid-argument', 'deviceLabel must be a string.');
    const value = label.trim();
    if (!value)
        return undefined;
    if (value.length > 80)
        throw new https_1.HttpsError('invalid-argument', 'deviceLabel is too long.');
    return value;
}
function hashPin(pin) {
    const salt = (0, node_crypto_1.randomBytes)(16);
    const hash = (0, node_crypto_1.pbkdf2Sync)(pin, salt, PIN_ITERATIONS, PIN_KEYLEN, PIN_DIGEST);
    return { saltHex: salt.toString('hex'), hashHex: hash.toString('hex') };
}
function verifyPin(pin, saltHex, hashHex, iterations) {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = (0, node_crypto_1.pbkdf2Sync)(pin, Buffer.from(saltHex, 'hex'), iterations, expected.length, PIN_DIGEST);
    if (expected.length !== actual.length)
        return false;
    return (0, node_crypto_1.timingSafeEqual)(expected, actual);
}
function timestampToIso(value) {
    if (value instanceof firestore_1.Timestamp)
        return value.toDate().toISOString();
    return undefined;
}
exports.createCoachProfile = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const payload = (request.data || {});
    const firstName = cleanName(payload.firstName, 'firstName');
    const lastName = cleanName(payload.lastName, 'lastName');
    const pin = cleanPin(payload.pin);
    const deviceLabel = cleanDeviceLabel(payload.deviceLabel);
    const nameKey = toNameKey(firstName, lastName);
    const coachRef = db.collection('coaches').doc();
    const secretRef = db.collection('coachSecrets').doc(coachRef.id);
    const deviceRef = db.collection('devices').doc(uid);
    const { saltHex, hashHex } = hashPin(pin);
    const now = firestore_1.FieldValue.serverTimestamp();
    const coach = { firstName, lastName, nameKey, createdAt: now };
    const batch = db.batch();
    batch.set(coachRef, coach);
    batch.set(secretRef, {
        pinSalt: saltHex,
        pinHash: hashHex,
        pinIterations: PIN_ITERATIONS,
        pinAlgo: PIN_ALGO,
        createdAt: now,
    });
    batch.set(deviceRef, {
        coachId: coachRef.id,
        ...(deviceLabel ? { deviceLabel } : {}),
        createdAt: now,
        lastSeenAt: now,
    });
    await batch.commit();
    return { coachId: coachRef.id };
});
exports.linkDeviceToCoach = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const payload = (request.data || {});
    const firstName = cleanName(payload.firstName, 'firstName');
    const lastName = cleanName(payload.lastName, 'lastName');
    const pin = cleanPin(payload.pin);
    const deviceLabel = cleanDeviceLabel(payload.deviceLabel);
    const requestedCoachId = typeof payload.coachId === 'string' && payload.coachId.trim() ? payload.coachId.trim() : undefined;
    const nameKey = toNameKey(firstName, lastName);
    let coachId = requestedCoachId;
    if (!coachId) {
        const snap = await db.collection('coaches').where('nameKey', '==', nameKey).limit(10).get();
        if (snap.empty)
            throw new https_1.HttpsError('not-found', 'No coach found');
        if (snap.size > 1) {
            return {
                requiresPick: true,
                matches: snap.docs.map((d) => {
                    const data = d.data();
                    return {
                        coachId: d.id,
                        firstName: typeof data.firstName === 'string' ? data.firstName : '',
                        lastName: typeof data.lastName === 'string' ? data.lastName : '',
                        createdAt: timestampToIso(data.createdAt),
                    };
                }),
            };
        }
        coachId = snap.docs[0].id;
    }
    const coachRef = db.collection('coaches').doc(coachId);
    const coachSnap = await coachRef.get();
    if (!coachSnap.exists)
        throw new https_1.HttpsError('not-found', 'No coach found');
    const coachData = coachSnap.data();
    if (typeof coachData.nameKey !== 'string' || coachData.nameKey !== nameKey) {
        throw new https_1.HttpsError('invalid-argument', 'Coach details do not match.');
    }
    const secretRef = db.collection('coachSecrets').doc(coachId);
    const secretSnap = await secretRef.get();
    if (!secretSnap.exists)
        throw new https_1.HttpsError('failed-precondition', 'Coach secret record missing.');
    const secretData = secretSnap.data();
    const salt = typeof secretData.pinSalt === 'string' ? secretData.pinSalt : '';
    const hash = typeof secretData.pinHash === 'string' ? secretData.pinHash : '';
    const iterations = typeof secretData.pinIterations === 'number' ? secretData.pinIterations : PIN_ITERATIONS;
    if (!salt || !hash || !verifyPin(pin, salt, hash, iterations)) {
        throw new https_1.HttpsError('permission-denied', 'Invalid PIN');
    }
    const deviceRef = db.collection('devices').doc(uid);
    const deviceSnap = await deviceRef.get();
    const existingData = deviceSnap.exists ? deviceSnap.data() : null;
    const now = firestore_1.FieldValue.serverTimestamp();
    if (existingData && existingData.coachId === coachId) {
        await deviceRef.set({
            ...(deviceLabel ? { deviceLabel } : {}),
            lastSeenAt: now,
        }, { merge: true });
        return { coachId };
    }
    await deviceRef.set({
        coachId,
        ...(deviceLabel ? { deviceLabel } : {}),
        createdAt: existingData?.createdAt ?? now,
        lastSeenAt: now,
    });
    return { coachId };
});
exports.touchDevice = (0, https_1.onCall)(async (request) => {
    const uid = requireAuthUid(request.auth?.uid);
    const ref = db.collection('devices').doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
        await ref.set({ lastSeenAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
    }
    return { ok: true };
});
