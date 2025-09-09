import React, { useState } from 'react';

const AuthPage = ({ onLogin }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [id, setId] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/Signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, id, password })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || '회원가입 중 오류가 발생했습니다.');
            }
            alert('회원가입이 완료되었습니다. 로그인 해주세요.');
            setIsLoginView(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const response = await fetch('/api/Login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, password })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || '로그인 중 오류가 발생했습니다.');
            }
            
            localStorage.setItem('user', JSON.stringify(data));
            onLogin(data);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <div className="logo-box"/>
                    <h1>Daily Compass</h1>
                </div>
                {isLoginView ? (
                    <form onSubmit={handleLogin} className="auth-form">
                        <input type="text" placeholder="ID를 입력해주세요." value={id} onChange={e => setId(e.target.value)} required />
                        <input type="password" placeholder="비밀번호를 입력해주세요." value={password} onChange={e => setPassword(e.target.value)} required />
                        {error && <p className="error-message">{error}</p>}
                        <button type="submit" disabled={isLoading}>{isLoading ? '로그인 중...' : '로그인'}</button>
                        <p className="switch-text">계정이 없으신가요? <span onClick={() => setIsLoginView(false)}>회원가입</span></p>
                    </form>
                ) : (
                    <form onSubmit={handleSignup} className="auth-form">
                        <input type="text" placeholder="닉네임을 입력하세요" value={nickname} onChange={e => setNickname(e.target.value)} required />
                        <input type="text" placeholder="사용할 아이디를 입력하세요" value={id} onChange={e => setId(e.target.value)} required />
                        <input type="password" placeholder="비밀번호를 입력하세요" value={password} onChange={e => setPassword(e.target.value)} required />
                        <input type="password" placeholder="비밀번호를 다시 입력하세요" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                        {error && <p className="error-message">{error}</p>}
                        <button type="submit" disabled={isLoading}>{isLoading ? '가입 중...' : '가입하기'}</button>
                        <p className="switch-text">이미 계정이 있으신가요? <span onClick={() => setIsLoginView(true)}>로그인</span></p>
                    </form>
                )}
            </div>
        </div>
    );
};

export default AuthPage;

