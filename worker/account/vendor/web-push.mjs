/* @block65/webcrypto-web-push v2.0.0 (MIT), https://github.com/block65/webcrypto-web-push/tree/v2.0.0
Bundled without cryptographic changes; uint8array-extras replaced by standard Web API byte helpers. See LICENSE.web-push.md. */

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/bytes.ts
var stringToUint8Array = (s) => new TextEncoder().encode(s);
var toUint8Array = (v) => v instanceof Uint8Array ? v : new Uint8Array(v);
var uint8ArrayToBase64 = (v, { urlSafe = false } = {}) => {
  const s = btoa(String.fromCharCode(...v));
  return urlSafe ? s.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "") : s;
};
var base64ToUint8Array = (s) => Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
var concatUint8Arrays = (arrays) => {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.byteLength, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.byteLength;
  }
  return out;
};

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/utils.ts
function encodeRecordSize(size) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, size);
  return bytes;
}
function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/client-keys.ts
async function deriveClientKeys(sub) {
  const bytes = base64ToUint8Array(sub.keys.p256dh);
  const authSecretBytes = base64ToUint8Array(sub.keys.auth);
  invariant(
    bytes.byteLength === 65 && bytes[0] === 4,
    "Subscription p256dh is not an uncompressed P-256 point"
  );
  invariant(
    authSecretBytes.byteLength === 16,
    "Subscription auth secret is not 16 bytes"
  );
  return {
    publicKeyBytes: bytes,
    publicKey: await crypto.subtle.importKey(
      "raw",
      bytes,
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      false,
      []
    ),
    authSecretBytes
  };
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/hkdf.ts
function createHMAC(data) {
  const keyPromise = crypto.subtle.importKey(
    "raw",
    data,
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  return {
    hash: async (input) => {
      const k = await keyPromise;
      return crypto.subtle.sign("HMAC", k, input);
    }
  };
}
async function hkdf(salt, ikm) {
  const prkhPromise = createHMAC(salt).hash(ikm).then((prk) => createHMAC(prk));
  return {
    extract: async (info, len) => {
      const prkh = await prkhPromise;
      const blocks = await Array.from(
        { length: Math.ceil(len / 32) },
        (_, i) => i
      ).reduce(async (acc, i) => {
        const previous = await acc;
        const hash = await prkh.hash(
          new Uint8Array([...previous.at(-1) ?? [], ...info, i + 1])
        );
        return [...previous, new Uint8Array(hash)];
      }, Promise.resolve([]));
      return concatUint8Arrays(blocks).slice(0, len);
    }
  };
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/info.ts
function createKeyInfo(clientPublic, serverPublic) {
  return new Uint8Array([
    ...stringToUint8Array("WebPush: info\0"),
    ...clientPublic,
    ...serverPublic
  ]);
}
function createInfo(type) {
  return stringToUint8Array(`Content-Encoding: ${type}\0`);
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/local-keys.ts
async function generateLocalKeys() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    false,
    ["deriveBits"]
  );
  return {
    privateKey: keyPair.privateKey,
    publicKeyBytes: new Uint8Array(
      await crypto.subtle.exportKey("raw", keyPair.publicKey)
    )
  };
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/salt.ts
async function getSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/encrypt.ts
var recordSize = 4096;
var headerSize = 21 + 65;
var maxPlaintextSize = recordSize - headerSize - 17;
async function encryptNotification(subscription, plaintext, options = {}) {
  invariant(
    plaintext.byteLength <= maxPlaintextSize,
    `Payload is ${plaintext.byteLength} bytes, the maximum is ${maxPlaintextSize}`
  );
  const clientKeys = await deriveClientKeys(subscription);
  const salt = await getSalt();
  const localKeys = await generateLocalKeys();
  const sharedSecret = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: clientKeys.publicKey
    },
    localKeys.privateKey,
    256
  );
  const keyInfo = createKeyInfo(
    clientKeys.publicKeyBytes,
    localKeys.publicKeyBytes
  );
  const cekInfo = createInfo("aes128gcm");
  const nonceInfo = createInfo("nonce");
  const ikmHkdf = await hkdf(clientKeys.authSecretBytes, sharedSecret);
  const ikm = await ikmHkdf.extract(keyInfo, 32);
  const messageHkdf = await hkdf(salt, ikm);
  const cekBytes = await messageHkdf.extract(cekInfo, 16);
  const nonceBytes = await messageHkdf.extract(nonceInfo, 12);
  const cekCryptoKey = await crypto.subtle.importKey(
    "raw",
    cekBytes,
    {
      name: "AES-GCM",
      length: 128
    },
    false,
    ["encrypt"]
  );
  const padTo = options.pad ?? true ? maxPlaintextSize : plaintext.byteLength;
  const padded = new Uint8Array(padTo + 1);
  padded.set(plaintext);
  padded[plaintext.byteLength] = 2;
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonceBytes
    },
    cekCryptoKey,
    padded
  );
  return new Uint8Array([
    ...salt,
    ...encodeRecordSize(recordSize),
    localKeys.publicKeyBytes.byteLength,
    ...localKeys.publicKeyBytes,
    ...new Uint8Array(encrypted)
  ]);
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/base64.ts
function encodeBase64Url(value) {
  return uint8ArrayToBase64(toUint8Array(value), { urlSafe: true });
}
function objectToBase64Url(obj) {
  return encodeBase64Url(stringToUint8Array(JSON.stringify(obj)));
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/jwt.ts
async function sign(payload, key) {
  const headerStr = objectToBase64Url({
    typ: "JWT",
    alg: "ES256"
  });
  const payloadStr = objectToBase64Url({
    iat: Math.floor(Date.now() / 1e3),
    ...payload
  });
  const dataStr = `${headerStr}.${payloadStr}`;
  const signature = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256"
    },
    key,
    stringToUint8Array(dataStr)
  );
  return `${dataStr}.${encodeBase64Url(signature)}`;
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/vapid.ts
async function vapidHeaders(subscription, vapid) {
  invariant(vapid.subject, "Vapid subject is empty");
  invariant(vapid.privateKey, "Vapid private key is empty");
  invariant(vapid.publicKey, "Vapid public key is empty");
  const endpoint = new URL(subscription.endpoint);
  invariant(
    endpoint.protocol === "https:",
    `Subscription endpoint is not https: ${endpoint.protocol}`
  );
  const vapidPublicKeyBytes = base64ToUint8Array(vapid.publicKey);
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: encodeBase64Url(vapidPublicKeyBytes.slice(1, 33)),
      y: encodeBase64Url(vapidPublicKeyBytes.slice(33, 65)),
      d: vapid.privateKey
    },
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    false,
    ["sign"]
  );
  const jwt = await sign(
    {
      aud: endpoint.origin,
      exp: Math.floor(Date.now() / 1e3) + 12 * 60 * 60,
      sub: vapid.subject
    },
    publicKey
  );
  return {
    headers: {
      authorization: `vapid t=${jwt}, k=${vapid.publicKey}`
    }
  };
}

// ../../../../tmp/marketnote-webpush-v2/packages/web-push/lib/payload.ts
async function buildPushPayload(message, subscription, vapid) {
  const { headers } = await vapidHeaders(subscription, vapid);
  const body = await encryptNotification(
    subscription,
    stringToUint8Array(
      // if its a primitive, convert to string, otherwise stringify
      typeof message.data === "string" || typeof message.data === "number" ? message.data.toString() : JSON.stringify(message.data)
    )
  );
  return {
    headers: {
      ...headers,
      ttl: (message.options?.ttl || 60).toString(),
      ...message.options?.urgency && {
        urgency: message.options.urgency
      },
      ...message.options?.topic && {
        topic: message.options.topic
      },
      "content-encoding": "aes128gcm",
      "content-length": body.byteLength.toString(),
      "content-type": "application/octet-stream"
    },
    method: "post",
    body
  };
}
export {
  buildPushPayload,
  encryptNotification,
  vapidHeaders
};
