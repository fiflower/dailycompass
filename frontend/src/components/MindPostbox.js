import React, { useState, useEffect, useRef } from 'react';

// --- 아이콘 SVG 컴포넌트 ---
const SoundIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg> );
const StopIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12"></rect></svg> );


const MindPostbox = () => {
    const [selectedMood, setSelectedMood] = useState(null);
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [showResult, setShowResult] = useState(false);

    // --- 음성 재생을 위한 State 추가 ---
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isFetchingAudio, setIsFetchingAudio] = useState(false);
    const audioRef = useRef(null); // Audio 객체를 저장하기 위한 Ref

    // 컴포넌트가 언마운트되거나 메시지가 바뀔 때 오디오 정리
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [message]);


    const handleMoodSelect = (mood) => {
        setSelectedMood(mood);
        if (error) setError(null);
    };

    const handleTextChange = (e) => {
        setText(e.target.value);
    };

    const sendMessage = async () => {
        if (!selectedMood) {
            showErrorWithTimeout("지금 기분을 선택해주세요.");
            return;
        }
        if (text.trim() === "") {
            showErrorWithTimeout("당신의 이야기를 들려주세요.");
            return;
        }

        setIsLoading(true);
        setError(null);

        // 새 메시지를 받으면 이전 오디오는 정지
        if (audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
        }

        try {
            const functionUrl = `/api/GetRandomMessage?mood=${selectedMood}`;
            const response = await fetch(functionUrl);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "서버에서 응답을 받지 못했습니다.");
            }

            setMessage(data.content);
            setShowResult(true);
        } catch (err) {
            showErrorWithTimeout(err.message || "메시지를 가져오는 중 오류가 발생했습니다.");
            console.error("Error fetching message:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- 음성 재생 핸들러 함수 ---
    const handleSpeak = async () => {
        if (isSpeaking) {
            // 이미 재생 중이면 정지
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsSpeaking(false);
            return;
        }

        if (!message) return;
        
        setIsFetchingAudio(true);
        setError(null);

        try {
            const response = await fetch('/api/TextToSpeech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: message, mood: selectedMood })
            });

            if (!response.ok) {
                throw new Error("음성을 변환하는 중 오류가 발생했습니다.");
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onplay = () => setIsSpeaking(true);
            audio.onpause = () => setIsSpeaking(false); // pause 이벤트 발생 시 상태 변경
            audio.onended = () => {
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl); // 메모리 정리
            };
            
            audio.play();

        } catch (err) {
            showErrorWithTimeout(err.message);
            console.error("Error synthesizing speech:", err);
        } finally {
            setIsFetchingAudio(false);
        }
    };
    
    const resetForm = () => {
        setSelectedMood(null);
        setText("");
        setIsLoading(false);
        setError(null);
        setMessage(null);
        setShowResult(false);
        if (audioRef.current) {
            audioRef.current.pause();
            setIsSpeaking(false);
        }
    };

    const showErrorWithTimeout = (message) => {
        setError(message);
        setTimeout(() => setError(null), 3000);
    };

    return (
        <div className="mind-postbox-container">
            <h2 className="postbox-title">마음 우체통</h2>
            <p className="postbox-subtitle">
                당신의 마음을 전해주세요. 좋은 기분이든, 나쁜 기분이든 모두 괜찮아요.
            </p>

            <div className="mood-section">
                 <label className="mood-label">지금 기분이 어떠세요?</label>
                 <div className="mood-buttons">
                     <button
                         className={`mood-btn good ${selectedMood === "good" ? "selected" : ""}`}
                         onClick={() => handleMoodSelect("good")}
                     >
                         😊 좋음
                     </button>
                     <button
                         className={`mood-btn bad ${selectedMood === "bad" ? "selected" : ""}`}
                         onClick={() => handleMoodSelect("bad")}
                     >
                         😔 나쁨
                     </button>
                 </div>
            </div>

            <div className="text-section">
                <textarea
                    className="text-input"
                    placeholder="당신의 이야기를 들려주세요..."
                    maxLength="500"
                    value={text}
                    onChange={handleTextChange}
                ></textarea>
            </div>

            <button className="submit-btn" onClick={sendMessage} disabled={isLoading}>
                {isLoading ? (
                    <><span className="loading"></span><span>전송 중...</span></>
                ) : ( "💌 보내기" )}
            </button>

            {error && <div className="error-message">{error}</div>}

            {showResult && (
                <div className="result-section show">
                    {/* CSS 그리드를 위한 래퍼 추가 */}
                    <div className="message-card-wrapper">
                        <div className="message-card">
                            <div className="message-content">{message}</div>
                            <div className="message-author">- 마음 우체통에서</div>
                        </div>
                        {/* ▼▼▼ 여기가 핵심 추가 부분입니다! ▼▼▼ */}
                        <button 
                            className="speak-btn" 
                            onClick={handleSpeak} 
                            disabled={isFetchingAudio}
                            title={isSpeaking ? "재생 중지" : "음성으로 듣기"}
                        >
                            {isFetchingAudio ? <span className="loading-small"></span> : (isSpeaking ? <StopIcon /> : <SoundIcon />)}
                        </button>
                        {/* ▲▲▲ 여기가 핵심 추가 부분입니다! ▲▲▲ */}
                    </div>
                    <div className="action-buttons">
                        <button className="action-btn" onClick={sendMessage} disabled={isLoading}>🔄 다시 받기</button>
                        <button className="action-btn" onClick={resetForm}>✨ 다른 기분으로</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MindPostbox;

