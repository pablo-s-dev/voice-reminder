function speakMessage(message, selectedVoiceURI, speed, volume) {
    if (!('speechSynthesis' in window)) {
        console.error("SpeechSynthesis API not supported in this offscreen document.");
        return;
    }

    const setAndSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(message);
        let targetVoice = null;

        const voices = window.speechSynthesis.getVoices();

        if (selectedVoiceURI && selectedVoiceURI !== 'auto') {
            targetVoice = voices.find(voice => voice.voiceURI === selectedVoiceURI);
            if (targetVoice) {
                utterance.voice = targetVoice;
                utterance.lang = targetVoice.lang;
            } else {
                console.warn(`Selected voice with URI "${selectedVoiceURI}" not found. Falling back to default language.`);
                utterance.lang = 'en-US';
            }
        } else {
            if (voices.length > 0) {
                targetVoice = voices[0];
                utterance.voice = targetVoice;
                utterance.lang = targetVoice.lang;
            } else {
                console.error("No voices available on the system. Cannot speak message.");
                return;
            }
        }

        utterance.rate = speed !== undefined ? speed : 1.0;
        utterance.volume = volume !== undefined ? volume : 1.0;
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
        setAndSpeak();
    } else {
        window.speechSynthesis.onvoiceschanged = () => {
            setAndSpeak();
            window.speechSynthesis.onvoiceschanged = null;
        };
    }
}

chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'speak') {
        speakMessage(request.message, request.selectedVoiceURI, request.speed, request.volume);
    }
});