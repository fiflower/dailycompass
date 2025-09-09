const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;  // 코드가 실제로 이 키를 보는지 확인
console.log('MONGO_URI exists?', typeof uri, !!uri);
if (!uri || typeof uri !== 'string') {
  throw new Error('MONGO_URI env not set (check key name and local.settings.json)');
}

const client = new MongoClient(uri);


module.exports = async function (context, req) {
    context.log('Signup function processed a request.');

    const { nickname, id, password } = req.body;

    // 필수 정보가 모두 있는지 확인합니다.
    if (!nickname || !id || !password) {
        context.res = {
            status: 400,
            body: { error: 'Nickname, ID, and password are required.' }
        };
        return;
    }

    try {
        // DB 연결이 없을 때만 새로 연결합니다.
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
        }

        const database = client.db("users"); // 'users' 데이터베이스 사용
        const collection = database.collection("userinfo");

        // 아이디 중복 확인
        const existingUser = await collection.findOne({ id: id });
        if (existingUser) {
            context.res = {
                status: 409, // 409: Conflict (리소스 충돌)
                body: { error: '이미 사용 중인 아이디입니다.' }
            };
            return;
        }

        // 새 사용자 추가 (참고: 실제 서비스에서는 비밀번호를 암호화해서 저장해야 합니다!)
        await collection.insertOne({ nickname, id, password });

        context.res = {
            status: 201, // 201: Created (성공적으로 생성됨)
            body: { message: '회원가입이 성공적으로 완료되었습니다.' }
        };

    } catch (error) {
        context.log.error(error);
        context.res = {
            status: 500,
            body: { error: 'Server error during signup.' }
        };
    }
};
