// CommonJS 기준
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
if (!uri) {
    throw new Error('MONGO_URI env not set');
}

const client = new MongoClient(uri);
let connected = false;

// 캐시를 비활성화하는 헤더
const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
};

module.exports = async function (context, req) {
    try {
        if (!connected) {
            await client.connect();
            await client.db('admin').command({ ping: 1 });
            connected = true;
            context.log('Mongo connection established');
        }

        const mood = req.query.mood || (req.body && req.body.mood);
        if (!mood || (mood !== 'good' && mood !== 'bad')) {
            context.res = {
                status: 400,
                headers: { ...NO_CACHE_HEADERS, 'Content-Type': 'application/json' },
                body: { error: 'A valid mood (good or bad) is required.' }
            };
            return;
        }

        const db = client.db('wisesaying');
        const collectionName = mood === 'good' ? 'emotion_good' : 'emotion_bad';
        const col = db.collection(collectionName);

        // ▼▼▼ 여기가 핵심 수정 부분입니다! ▼▼▼
        
        // 1. 컬렉션의 전체 문서 수를 가져옵니다.
        const count = await col.countDocuments();

        if (count === 0) {
            context.res = {
                status: 404,
                headers: { ...NO_CACHE_HEADERS, 'Content-Type': 'application/json' },
                body: { content: '이런, 지금은 드릴 메시지가 없네요.' }
            };
            return;
        }

        // 2. 0부터 (count - 1) 사이의 랜덤한 인덱스를 생성합니다.
        const randomIndex = Math.floor(Math.random() * count);
        context.log(`[DEBUG] Total documents: ${count}, Random index generated: ${randomIndex}`);

        // 3. 랜덤 인덱스만큼 건너뛰고 1개의 문서를 가져옵니다.
        const randomItems = await col.find().skip(randomIndex).limit(1).toArray();
        
        // ▲▲▲ 여기가 핵심 수정 부분입니다! ▲▲▲

        if (randomItems.length === 0) {
            context.res = {
                status: 404,
                headers: { ...NO_CACHE_HEADERS, 'Content-Type': 'application/json' },
                body: { content: '메시지를 찾는 데 실패했어요. 다시 시도해주세요.' }
            };
            return;
        }
        
        const doc = randomItems[0];

        context.res = {
            status: 200,
            headers: { ...NO_CACHE_HEADERS, 'Content-Type': 'application/json' },
            body: { content: doc.content }
        };

    } catch (error) {
        context.log.error(error);
        context.res = {
            status: 500,
            headers: { ...NO_CACHE_HEADERS, 'Content-Type': 'application/json' },
            body: { error: 'Server error while fetching message.' }
        };
    }
};

