let creatingOffscreenDocument;

async function setupOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (creatingOffscreenDocument) {
        await creatingOffscreenDocument;
    } else {
        creatingOffscreenDocument = chrome.offscreen.createDocument({
            url: path,
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Plays reminder messages using Text-to-Speech API.',
        });
        await creatingOffscreenDocument;
        creatingOffscreenDocument = null;
    }
}

async function closeOffscreenDocument() {
    const offscreenUrl = chrome.runtime.getURL('offscreen.html');
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
        try {
            await chrome.offscreen.closeDocument();
            console.log('Offscreen document closed successfully.');
        } catch (error) {
            console.error('Error closing offscreen document:', error);
        }
    }
}

async function broadcastAlarmState() {
    const result = await chrome.storage.local.get('isRunning');
    const isRunning = result.isRunning !== undefined ? result.isRunning : false;
    try {
        await chrome.runtime.sendMessage({
            action: 'alarmStateUpdate',
            isActive: isRunning
        });
        console.log('Broadcasted alarm state:', isRunning);
    } catch (error) {
        if (error.message.includes('Receiving end does not exist')) {
            console.log('No popup open to receive alarm state update.');
        } else {
            console.error('Error broadcasting alarm state:', error);
        }
    }
}

async function resetState() {
    await closeOffscreenDocument(); 
    await chrome.alarms.clear('attentionReminder'); 
    await chrome.storage.local.set({ isRunning: false, currentPhraseIndex: 0 });
    console.log("Reminder state reset to stopped.");
    await broadcastAlarmState(); 
}

chrome.runtime.onStartup.addListener(() => {
    resetState();
});

chrome.runtime.onInstalled.addListener(() => {
    resetState();
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startAlarm') {
        const messages = request.messages;
        const interval = request.interval;
        const selectedVoiceURI = request.selectedVoiceURI;
        const speed = request.speed;
        const volume = request.volume;
        const initialIndex = request.initialIndex || 0;

        chrome.storage.local.set({ messages: messages, interval: interval, isRunning: true, selectedVoiceURI: selectedVoiceURI, speed: speed, volume: volume, currentPhraseIndex: initialIndex }, async () => {
            chrome.alarms.clear('attentionReminder', async () => {
                chrome.alarms.create('attentionReminder', { periodInMinutes: interval / 60 });
                sendResponse({ success: true });
                await broadcastAlarmState();
            });
        });
        return true;
    } else if (request.action === 'stopAlarm') {
        chrome.alarms.clear('attentionReminder', async () => {
            await closeOffscreenDocument();
            chrome.storage.local.set({ isRunning: false });
            sendResponse({ success: true });
            await broadcastAlarmState();
        });
        return true;
    } else if (request.action === 'getAlarmStatus') {
        chrome.alarms.get('attentionReminder', (alarm) => {
            chrome.storage.local.get('isRunning', (result) => {
                const isRunningInStorage = result.isRunning !== undefined ? result.isRunning : false;
                sendResponse({ isActive: !!alarm && isRunningInStorage });
            });
        });
        return true;
    }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'attentionReminder') {
        const result = await chrome.storage.local.get(['messages', 'selectedVoiceURI', 'speed', 'volume', 'currentPhraseIndex', 'isRunning']);
        
        if (!result.isRunning) {
            console.log("Alarm fired, but reminder is not marked as running. Skipping speech.");
            return;
        }

        const messages = result.messages || [];
        let currentPhraseIndex = result.currentPhraseIndex || 0;
        const non_empty_messages = messages.filter(msg => msg !== '');

        if (non_empty_messages.length > 0) {
            const messageToSpeak = non_empty_messages[currentPhraseIndex % non_empty_messages.length];
            currentPhraseIndex = (currentPhraseIndex + 1) % non_empty_messages.length;
            await chrome.storage.local.set({ currentPhraseIndex: currentPhraseIndex });

            await setupOffscreenDocument('offscreen.html');

            const offscreenUrl = chrome.runtime.getURL('offscreen.html');
            const maxAttempts = 5;
            let attempts = 0;

            async function trySendMessage() {
                const contexts = await chrome.runtime.getContexts({
                    contextTypes: ['OFFSCREEN_DOCUMENT'],
                    documentUrls: [offscreenUrl],
                });

                if (contexts.length === 0) {
                    if (attempts < maxAttempts) {
                        attempts++;
                        console.log(`Offscreen document not ready, retrying (${attempts}/${maxAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 500));
                        return trySendMessage();
                    } else {
                        console.error('Failed to send message: Offscreen document not available after retries.');
                        return;
                    }
                }

                try {
                    await chrome.runtime.sendMessage({
                        action: 'speak',
                        message: messageToSpeak,
                        selectedVoiceURI: result.selectedVoiceURI,
                        speed: result.speed,
                        volume: result.volume
                    });
                    console.log('Message sent to offscreen document successfully.');
                } catch (error) {
                    console.error('Error sending message to offscreen document:', error);
                }
            }

            await trySendMessage();
        } else {
            chrome.alarms.clear('attentionReminder');
            await closeOffscreenDocument();
            await chrome.storage.local.set({ isRunning: false, currentPhraseIndex: 0 });
            console.log("No non-empty messages to speak. Reminder stopped.");
            await broadcastAlarmState();
        }
    }
});