// /login/index.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB || 'users';
const COLL = process.env.MONGO_COLLECTION || 'userinfo';

// 모듈 전역 재사용 (함수 콜드스타트 이후에도 유지)
let client;
let db;

module.exports = async function (context, req) {
  context.log('[login] function invoked');

  try {
    // 0) 환경변수 확인
    if (!uri) {
      context.log.error('MONGO_URI is missing');
      context.res = { status: 500, body: { ok: false, error: 'SERVER_MISCONFIGURED' } };
      return;
    }

    // 1) Mongo 연결 (v6: connect는 idempotent)
    if (!client) {
      client = new MongoClient(uri);
    }
    if (!db) {
      await client.connect();
      db = client.db(DB_NAME);
      context.log(`[login] connected to MongoDB db=${DB_NAME}`);
    }

    // 2) 입력 파싱 (email 또는 id 지원)
    const body = req.body || {};
    const emailOrId = (body.email || body.id || '').toString().trim();
    const password = (body.password || '').toString().trim();

    if (!emailOrId || !password) {
      context.res = { status: 400, body: { ok: false, error: 'MISSING_CREDENTIALS' } };
      return;
    }

    // 3) 사용자 조회 (email 또는 id 어느 컬럼에 저장되어 있든 잡기)
    const collection = db.collection(COLL);
    const user = await collection.findOne({
      $or: [{ email: emailOrId }, { id: emailOrId }]
    });

    // 4) 인증
    if (!user) {
      context.res = { status: 401, body: { ok: false, error: 'INVALID_CREDENTIALS' } };
      return;
    }

    // TODO(보안): 실제 운영에서는 bcrypt 사용 권장
    // const bcrypt = require('bcryptjs');
    // const ok = await bcrypt.compare(password, user.passwordHash);
    // if (!ok) { ... }

    if (user.password !== password) {
      context.res = { status: 401, body: { ok: false, error: 'INVALID_CREDENTIALS' } };
      return;
    }

    // 5) 성공 응답 (민감정보 제외)
    context.res = {
      status: 200,
      body: {
        ok: true,
        user: {
          email: user.email ?? user.id, // email이 없으면 id 반환
          nickname: user.nickname || ''
        }
      }
    };
  } catch (err) {
    context.log.error('[login] error:', err);
    context.res = { status: 500, body: { ok: false, error: 'SERVER_ERROR' } };
  }
};
