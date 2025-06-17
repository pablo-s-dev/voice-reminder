const messageInputsContainer = document.getElementById('messageInputsContainer');
const addPhraseButton = document.getElementById('addPhraseButton');
const intervalInput = document.getElementById('intervalInput');
const voiceSelect = document.getElementById('voiceSelect');
const speedInput = document.getElementById('speedInput');
const speedValueSpan = document.getElementById('speedValue');
const volumeInput = document.getElementById('volumeInput');
const volumeValueSpan = document.getElementById('volumeValue');
const voiceStatusMessage = document.getElementById('voiceStatusMessage');
const actionButton = document.getElementById('actionButton');
const actionIcon = document.getElementById("actionIcon");
// const statusMessage = document.getElementById('statusMessage');

let messages = [];

function updateButtonStates(isRunning) {
    if (isRunning) {
        actionIcon.classList.remove("play-icon");
        actionIcon.classList.add("stop-icon");
        // actionButton.textContent = 'Stop';
        // actionButton.classList.remove('start-button');
        // actionButton.classList.add('stop-button');
        // actionButton.disabled = false;
    } else {
        actionIcon.classList.add("play-icon");
        actionIcon.classList.remove("stop-icon");
        // actionButton.textContent = 'Start';
        // actionButton.classList.remove('stop-button');
        // actionButton.classList.add('start-button');
        // actionButton.disabled = false;
    }
    actionButton.disabled = false;
}

// function updateStatusMessage(isRunning) {
//     if (isRunning) {
//         statusMessage.textContent = 'Reminder active.';
//         statusMessage.classList.add('text-green-600');
//         statusMessage.classList.remove('text-gray-600', 'text-red-600');
//     } else {
//         statusMessage.textContent = 'Reminder stopped.';
//         statusMessage.classList.add('text-gray-600');
//         statusMessage.classList.remove('text-green-600', 'text-red-600');
//     }
// }

function updateRemoveButtonVisibility() {
    const messageItems = messageInputsContainer.querySelectorAll('.message-input-item');
    messageItems.forEach((item, index) => {
        const removeButton = item.querySelector('.remove-phrase-button');
        if (removeButton) {
            if (messageItems.length > 1) {
                removeButton.classList.add('visible');
            } else {
                removeButton.classList.remove('visible');
            }
        }
    });
}

function saveMessagesToStorage() {
    messages = Array.from(messageInputsContainer.querySelectorAll('input[type="text"]'))
                     .map(input => input.value.trim());
    chrome.storage.local.set({ messages: messages });
    updateRemoveButtonVisibility();
}

function addMessageInput(message = '') {
    const div = document.createElement('div');
    div.classList.add('message-input-item');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter your reminder phrase...';
    input.value = message;
    input.addEventListener('input', saveMessagesToStorage);

    const removeButton = document.createElement('button');
    removeButton.classList.add('remove-phrase-button');
    removeButton.title = 'Remove this phrase';
    removeButton.innerHTML = '✕';
    removeButton.addEventListener('click', () => {
        if (messageInputsContainer.children.length > 1) {
            messageInputsContainer.removeChild(div);
            saveMessagesToStorage();
        } else {
            input.value = '';
            saveMessagesToStorage();
            // statusMessage.textContent = 'Last phrase cleared. Add more if needed.';
            // setTimeout(() => {
            //     statusMessage.textContent = '';
            // }, 3000);
        }
    });

    div.appendChild(input);
    div.appendChild(removeButton);
    messageInputsContainer.appendChild(div);
    updateRemoveButtonVisibility();
}

addPhraseButton.addEventListener('click', () => addMessageInput());

function populateVoiceList() {
    if (!('speechSynthesis' in window)) {
        voiceStatusMessage.textContent = 'Text-to-Speech not supported. Please use Chrome or Edge.';
        voiceStatusMessage.classList.add('text-red-600');
        voiceSelect.style.display = 'none';
        actionButton.disabled = true;
        return;
    }

    const voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    if (voices.length === 0) {
        voiceStatusMessage.textContent = 'No voices found. Please ensure your browser (Chrome/Edge) has speech packs installed.';
        voiceStatusMessage.classList.add('text-red-600');
        voiceSelect.disabled = true;
        actionButton.disabled = true;
        return;
    } else {
        voiceStatusMessage.textContent = '';
        voiceSelect.disabled = false;
    }

    const autoVoiceOption = document.createElement('option');
    autoVoiceOption.textContent = 'Auto (Browser Default)';
    autoVoiceOption.value = 'auto';
    voiceSelect.appendChild(autoVoiceOption);

    voices.forEach((voice) => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.value = voice.voiceURI;
        voiceSelect.appendChild(option);
    });

    chrome.storage.local.get(['selectedVoiceURI'], (result) => {
        if (result.selectedVoiceURI) {
            voiceSelect.value = result.selectedVoiceURI;
        }
    });

    voiceSelect.addEventListener('change', () => {
        chrome.storage.local.set({ selectedVoiceURI: voiceSelect.value });
    });
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
}

document.addEventListener('DOMContentLoaded', () => {
    populateVoiceList();
    setTimeout(populateVoiceList, 100);

    speedInput.addEventListener('input', () => {
        speedValueSpan.textContent = speedInput.value;
        chrome.storage.local.set({ speed: parseFloat(speedInput.value) });
    });

    volumeInput.addEventListener('input', () => {
        volumeValueSpan.textContent = volumeInput.value;
        chrome.storage.local.set({ volume: parseFloat(volumeInput.value) });
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'alarmStateUpdate') {
            const isRunning = request.isActive || false;
            chrome.storage.local.set({ isRunning: isRunning }, () => {
                updateButtonStates(isRunning);
            });
        }
    });

    // Retry mechanism for initial state sync
    async function getInitialAlarmStatus(maxAttempts = 5) {
        let attempts = 0;
        while (attempts < maxAttempts) {
            try {
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'getAlarmStatus' }, resolve);
                });
                let isRunning = false;
                if (response && response.isActive !== undefined) {
                    isRunning = response.isActive;
                }
                chrome.storage.local.set({ isRunning: isRunning }, () => {
                    updateButtonStates(isRunning);
                });
                return;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) {
                    console.error('Failed to get initial alarm status after retries:', error);
                    chrome.storage.local.set({ isRunning: false }, () => {
                        updateButtonStates(false);
                    });
                } else {
                    console.log(`Retry ${attempts}/${maxAttempts} to get initial alarm status...`);
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                }
            }
        }
    }

    getInitialAlarmStatus();

    chrome.storage.local.get(['messages', 'interval', 'speed', 'volume', 'selectedVoiceURI', 'currentPhraseIndex'], (result) => {
        if (result.messages && result.messages.length > 0) {
            messages = result.messages;
            messages.forEach(msg => addMessageInput(msg));
        } else {
            addMessageInput();
        }
        
        if (result.interval) {
            intervalInput.value = result.interval;
        }
        if (result.speed !== undefined) {
            speedInput.value = result.speed;
            speedValueSpan.textContent = result.speed;
        } else {
            speedInput.value = 1.0;
            speedValueSpan.textContent = 1.0;
        }
        if (result.volume !== undefined) {
            volumeInput.value = result.volume;
            volumeValueSpan.textContent = result.volume;
        } else {
            volumeInput.value = 1.0;
            volumeValueSpan.textContent = 1.0;
        }
    });
});

actionButton.addEventListener('click', () => {
    chrome.storage.local.get('isRunning', (result) => {
        const isCurrentlyRunning = result.isRunning;

        if (isCurrentlyRunning) {
            chrome.runtime.sendMessage({ action: 'stopAlarm' }, (response) => {
                if (response && response.success) {
                    chrome.storage.local.set({ isRunning: false }, () => {
                        // statusMessage.textContent = 'Reminder stopped.';
                        // statusMessage.classList.add('text-gray-600');
                        // statusMessage.classList.remove('text-green-600', 'text-red-600');
                        updateButtonStates(false);
                    });
                } else {
                    // statusMessage.textContent = 'Error stopping reminder.';
                    // statusMessage.classList.add('text-red-600');
                    // statusMessage.classList.remove('text-green-600', 'text-gray-600');
                }
            });
        } else {
            saveMessagesToStorage();

            const non_empty_messages = messages.filter(msg => msg !== '');
            if (non_empty_messages.length === 0) {
                // statusMessage.textContent = 'Please add at least one non-empty phrase.';
                // statusMessage.classList.add('text-red-600');
                // statusMessage.classList.remove('text-green-600', 'text-gray-600');
                alert('Please add at least one non-empty phrase.');
                return;
            }

            const interval = parseInt(intervalInput.value);
            const selectedVoiceURI = voiceSelect.value;
            const speed = parseFloat(speedInput.value);
            const volume = parseFloat(volumeInput.value);

            if (isNaN(interval) || interval < 5) {
                // statusMessage.textContent = 'Invalid interval. Please use a number greater than 5.';
                // statusMessage.classList.add('text-red-600');
                // statusMessage.classList.remove('text-green-600', 'text-gray-600');
                alert('Invalid interval. Please use a number greater than 5.');
                return;
            }

            chrome.storage.local.set({ messages: non_empty_messages, interval: interval, isRunning: true, selectedVoiceURI: selectedVoiceURI, speed: speed, volume: volume, currentPhraseIndex: 0 }, () => {
                chrome.runtime.sendMessage({ action: 'startAlarm', messages: non_empty_messages, interval: interval, selectedVoiceURI: selectedVoiceURI, speed: speed, volume: volume, initialIndex: 0 }, (response) => {
                    if (response && response.success) {
                        // statusMessage.textContent = `Reminder started! Cycling through ${non_empty_messages.length} phrases every ${interval} seconds.`;
                        // statusMessage.classList.add('text-green-600');
                        // statusMessage.classList.remove('text-gray-600', 'text-red-600');
                        updateButtonStates(true);
                    } else {
                        // statusMessage.textContent = 'Error starting reminder.';
                        // statusMessage.classList.add('text-red-600');
                        // statusMessage.classList.remove('text-green-600', 'text-gray-600');
                    }
                });
            });
        }
    });
});