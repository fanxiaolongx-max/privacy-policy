// Process-local desktop UI preference. Browser storage remains the source on startup.
const { EventEmitter } = require('events');
const events = new EventEmitter();
let language = 'zh-CN';

function setLanguage(value) {
    if (!['zh-CN', 'en-US'].includes(value)) return false;
    if (language !== value) {
        language = value;
        events.emit('change', language);
    }
    return true;
}

module.exports = { getLanguage: () => language, setLanguage, events };
