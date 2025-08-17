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
const category_name_input = document.getElementById("category_name_input");
const newCategoryModalBtn = document.getElementById("newCategoryModalBtn");
const cancelCategoryBtn = document.getElementById("cancelCategoryBtn");
const categoryForm = document.getElementById("categoryForm");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const categorySelect = document.getElementById("categorySelect");
// const statusMessage = document.getElementById('statusMessage');

let messages = [];
let categories = {};

function showCategoryForm() {

    const modal = document.querySelector("#category_form_modal")

    modal.style.visibility = "visible";

}

newCategoryModalBtn.onclick = showCategoryForm;

function hideCategoryForm() {

    const modal = document.querySelector("#category_form_modal")

    modal.style.visibility = "hidden";

}

cancelCategoryBtn.onclick = hideCategoryForm;

function onSaveCategoryClick(e) {

    e.preventDefault();

    const categoryName = category_name_input.value;

    if (!categoryName) {
        alert("Invalid Category Name")
        return
    }
    if (categoryName.length > 20) {
        alert("Name is too long. It must have less than 21 characters.")
        return
    }

    saveCategoryOnStorage(categoryName)

    refreshCategorySelect();

    categorySelect.value = categoryName;

    applyCategory(categories[categoryName]);

    hideCategoryForm();

}

function saveCategoryOnStorage(categoryName) {

    const category = {
        name: categoryName,
        messages,
        volume: volumeInput.value,
        speed: speedInput.value,
        voice: voiceSelect.value,
        interval: intervalInput.value
    }

    categories[categoryName] = category;

    chrome.storage.local.set({ categories });

}

saveCategoryBtn.onclick = onSaveCategoryClick;

async function loadCategories() {

    try {

        const saved_categories = (await chrome.storage.local.get("categories")).categories;

        categories = saved_categories ?? {}
        refreshCategorySelect();
        
        const categoryName = categorySelect.value;
        const category = categories[categoryName]
        applyCategory(category);

    }
    catch (e) {
        console.log(e)
    }

}

loadCategories();

function refreshCategorySelect() {

    const categories_arr = Array.from(Object.values(categories));

    if (categories_arr.length == 0) {
        return;
    }

    categorySelect.innerHTML = "";

    categories_arr.forEach(category => {
        const option = document.createElement("option")

        option.value = category.name;
        option.innerText = category.name;

        categorySelect.appendChild(option);
    })
}

function applyCategory(category) {

    if (!category) return;

    if (category.volume != null){
         volumeInput.value = category.volume;
         volumeValueSpan.textContent = category.volume;
    }
    if (category.speed != null) {
        speedInput.value = category.speed;
        speedValueSpan.textContent = category.speed;
    }
    if (category.voice != null) {
        voiceSelect.value = category.voice;
    }
    if (category.interval != null) intervalInput.value = category.interval;
    if (category.messages) {
        messages = category.messages;
        syncMessages();
    }
}
categorySelect.onchange = e => {
    const categoryName = e.target.value;

    const category = categories[categoryName];

    applyCategory(category);
}

function syncMessages() {

    messageInputsContainer.innerHTML = "";
    messages.forEach(msg => addMessageInput(msg));
    syncDelBtns();
}


function syncBtnStates(isRunning) {
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

function syncDelBtns() {
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

function syncCategory() {
    messages = Array.from(messageInputsContainer.querySelectorAll('input[type="text"]'))
        .map(input => input.value.trim());
    const category = categories[categorySelect.value]

    category.messages = messages;
    category.voice = voiceSelect.value;
    category.volume = volumeInput.value;
    volumeValueSpan.textContent = volumeInput.value;
    category.speed = speedInput.value;
    speedValueSpan.textContent = speedInput.value;
    category.interval = intervalInput.value;
    category.name = categorySelect.value

    chrome.storage.local.set({ categories });
    syncDelBtns();
}

function addMessageInput(message = '') {
    const div = document.createElement('div');
    div.classList.add('message-input-item');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter your reminder phrase...';
    input.value = message;
    input.addEventListener('input', syncCategory);

    const removeButton = document.createElement('button');
    removeButton.classList.add('remove-phrase-button');
    removeButton.title = 'Remove this phrase';
    removeButton.innerHTML = '✕';
    removeButton.addEventListener('click', () => {
        if (messageInputsContainer.children.length > 1) {
            messageInputsContainer.removeChild(div);
            syncCategory();
        } else {
            input.value = '';
            syncCategory();
            // statusMessage.textContent = 'Last phrase cleared. Add more if needed.';
            // setTimeout(() => {
            //     statusMessage.textContent = '';
            // }, 3000);
        }
    });

    div.appendChild(input);
    div.appendChild(removeButton);
    messageInputsContainer.appendChild(div);
    syncDelBtns();
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

    // chrome.storage.local.get(['selectedVoiceURI'], (result) => {
    //     if (result.selectedVoiceURI) {
    //         voiceSelect.value = result.selectedVoiceURI;
    //     }
    // });

    voiceSelect.addEventListener('change', () => {
        syncCategory();
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
        syncCategory();
        // chrome.storage.local.set({ speed: parseFloat(speedInput.value) });
    });

    volumeInput.addEventListener('input', () => {
        volumeValueSpan.textContent = volumeInput.value;
        syncCategory();
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'alarmStateUpdate') {
            const isRunning = request.isActive || false;
            chrome.storage.local.set({ isRunning: isRunning }, () => {
                syncBtnStates(isRunning);
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
                    syncBtnStates(isRunning);
                });
                return;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) {
                    console.error('Failed to get initial alarm status after retries:', error);
                    chrome.storage.local.set({ isRunning: false }, () => {
                        syncBtnStates(false);
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
            syncMessages();
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
                        syncBtnStates(false);
                    });
                } else {
                    // statusMessage.textContent = 'Error stopping reminder.';
                    // statusMessage.classList.add('text-red-600');
                    // statusMessage.classList.remove('text-green-600', 'text-gray-600');
                }
            });
        } else {

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
                alert('Invalid interval. Please use a number greater than 4.');
                return;
            }

            chrome.storage.local.set({ isRunning: true, currentPhraseIndex: 0 }, () => {
                chrome.runtime.sendMessage({ action: 'startAlarm', messages: non_empty_messages, interval: interval, selectedVoiceURI: selectedVoiceURI, speed: speed, volume: volume, initialIndex: 0 }, (response) => {
                    if (response && response.success) {
                        // statusMessage.textContent = `Reminder started! Cycling through ${non_empty_messages.length} phrases every ${interval} seconds.`;
                        // statusMessage.classList.add('text-green-600');
                        // statusMessage.classList.remove('text-gray-600', 'text-red-600');
                        syncBtnStates(true);
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

