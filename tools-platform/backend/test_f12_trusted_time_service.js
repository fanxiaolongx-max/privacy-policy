const assert = require('assert');
const service = require('./models/f12-trusted-time-service');

function buildNtpResponse(unixTimeMs) {
    const message = Buffer.alloc(48);
    message[0] = 0x24;
    message[1] = 2;
    const ntpSeconds = Math.floor(unixTimeMs / 1000) + 2208988800;
    const fraction = Math.floor(((unixTimeMs % 1000) / 1000) * 0x100000000);
    message.writeUInt32BE(ntpSeconds >>> 0, 40);
    message.writeUInt32BE(fraction >>> 0, 44);
    return message;
}

const expected = Date.UTC(2026, 7, 5, 13, 30, 15, 250);
const parsed = service.parseNtpTransmitTime(buildNtpResponse(expected));
assert.ok(Math.abs(parsed - expected) < 1, '应正确解析 NTP UTC 时间戳');
assert.strictEqual(service.median([100, 300, 200]), 200);
assert.strictEqual(service.median([100, 300]), 200);
assert.throws(() => service.parseNtpTransmitTime(Buffer.alloc(10)), /长度不足/);
console.log('F12 trusted time service tests passed');
