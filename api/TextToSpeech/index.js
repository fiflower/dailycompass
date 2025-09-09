const axios = require('axios');

// Azure Speech Service의 키와 지역을 환경 변수에서 가져옵니다.
const subscriptionKey = process.env.SPEECH_KEY;
const serviceRegion = process.env.SPEECH_REGION;

// 1. 인증 토큰을 요청하는 함수
async function getAuthenticationToken() {
    const tokenEndpoint = `https://${serviceRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    try {
        const response = await axios.post(tokenEndpoint, null, {
            headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey }
        });
        return response.data;
    } catch (error) {
        console.error("Authentication token request failed:", error.response?.data || error.message);
        throw new Error("Failed to get authentication token.");
    }
}

module.exports = async function (context, req) {
    context.log('TextToSpeech function processed a request.');

    const { text, mood } = req.body;

    if (!text || !mood) {
        return { status: 400, body: "Please provide text and mood." };
    }
    if (!subscriptionKey || !serviceRegion) {
        console.error("Speech Key or Region is not set in application settings.");
        return { status: 500, body: "Speech service is not configured on the server." };
    }

    try {
        const token = await getAuthenticationToken();
        const ttsEndpoint = `https://${serviceRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;

        // 기분에 따라 목소리와 스타일을 결정합니다.
        const voiceName = mood === 'good' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
        const ssml = `
            <speak version='1.0' xml:lang='ko-KR'>
                <voice name='${voiceName}'>
                    <prosody rate="1.1">
                        ${text}
                    </prosody>
                </voice>
            </speak>`;

        const response = await axios.post(ttsEndpoint, ssml, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
            },
            responseType: 'arraybuffer' // 오디오 데이터를 바이너리 형태로 받습니다.
        });

        // 성공 시, 오디오 데이터를 그대로 클라이언트에 전달합니다.
        context.res = {
            status: 200,
            headers: { 'Content-Type': 'audio/mpeg' },
            body: Buffer.from(response.data, 'binary')
        };
        return context.res;


    } catch (error) {
        context.log.error(error);
        return { status: 500, body: "Failed to synthesize speech." };
    }
};
