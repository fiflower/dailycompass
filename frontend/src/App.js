import React, { useState, useEffect } from 'react';
import './App.css';
import MainPage from './components/MainPage';
import AuthPage from './components/AuthPage';

function App() {
    const [user, setUser] = useState(null);
    useEffect(() => {
        // localStorage에서 'user' 정보를 가져옵니다.
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                // 정보가 있다면, JSON으로 변환하여 user 상태를 설정합니다.
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error("Failed to parse user from localStorage", error);
                // 만약 저장된 정보가 잘못된 형식이라면 삭제합니다.
                localStorage.removeItem('user');
            }
        }
    }, []); // []를 비워두면 앱이 처음 렌더링될 때 딱 한 번만 실행됩니다.

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <div className="App">
            {user ? (
                <MainPage user={user} onLogout={handleLogout} />
            ) : (
                <AuthPage onLogin={handleLogin} />
            )}
        </div>
    );
}

export default App;
