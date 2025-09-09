const { MongoClient, ObjectId } = require('mongodb');

const COSMOS_DB_CONNECTION_STRING = process.env.MONGO_URI;
const DATABASE_NAME = "dbmoodpostbox";
const COLLECTION_NAME = "todolist";

if (!COSMOS_DB_CONNECTION_STRING) {
    throw new Error("Configuration error: MONGO_URI is not set in environment variables.");
}

let client = null;

// getUserInfo 함수는 x-ms-client-principal 헤더를 디코딩하여 사용자 정보를 가져옵니다.
function getUserInfo(req, context) {
    try {
        const header = req.headers['x-ms-client-principal'];
        if (!header) {
            context.log("Azure auth header not found. This is normal for local dev.");
            return null;
        }
        const decoded = Buffer.from(header, 'base64').toString('ascii');
        const principal = JSON.parse(decoded);
        const uniqueUserId = principal.userDetails;
        if (!uniqueUserId) {
            context.log.warn("Warning: Header found, but 'userDetails' is missing.");
            return null;
        }
        context.log(`Identified user '${uniqueUserId}' from Azure auth header.`);
        return uniqueUserId;
    } catch (error) {
        context.log.error("Failed to parse 'x-ms-client-principal' header.", error);
        return null;
    }
}

module.exports = async function (context, req) {
    context.log('Todo API function processed a request.');

    let userId = null;
    const devUserIdHeader = req.headers['x-dev-user-id'];

    if (devUserIdHeader) {
        try {
            // 프런트엔드에서 보내준 닉네임을 디코딩합니다.
            userId = decodeURIComponent(devUserIdHeader);
            context.log(`Using user ID from 'x-dev-user-id' header: '${userId}'`);
        } catch (e) {
            context.log.error("Failed to decode 'x-dev-user-id' header.", e);
            context.res = { status: 400, body: "Invalid user ID header." };
            return;
        }
    } else {
        // 헤더가 없으면 인증 실패
        context.res = { status: 401, body: "Unauthorized: User not authenticated." };
        return;
    }

    // 사용자 ID가 없으면 401 Unauthorized 오류를 반환합니다.
    if (!userId) {
        context.res = { status: 401, body: "Unauthorized: User not authenticated." };
        return;
    }

    try {
        if (!client) {
            client = new MongoClient(COSMOS_DB_CONNECTION_STRING);
            await client.connect();
            context.log("Successfully connected to database.");
        }
        const db = client.db(DATABASE_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const method = req.method.toLowerCase();
        const todoId = req.params.id;

        // ⭐ 중요: 모든 MongoDB 쿼리를 'userId'를 기준으로 필터링하도록 변경
        switch (method) {
            case 'get':
                // `_id`는 객체 ID이므로, 사용자 ID를 'nickname' 필드로 사용합니다.
                const userDocument_get = await collection.findOne({ nickname: userId });
                context.res = { status: 200, body: userDocument_get ? userDocument_get.todos : [] };
                break;
            case 'post':
                const newTodo = { _id: new ObjectId(), text: req.body.text, date: req.body.date, completed: false };
                await collection.updateOne({ nickname: userId }, { $push: { todos: newTodo } }, { upsert: true });
                context.res = { status: 201, body: newTodo };
                break;
            case 'put':
                if (!todoId) { context.res = { status: 400, body: "Todo ID is required." }; return; }
                await collection.updateOne({ nickname: userId, "todos._id": new ObjectId(todoId) }, { $set: { "todos.$.completed": req.body.completed } });
                context.res = { status: 200, body: "Todo updated." };
                break;
            case 'delete':
                if (!todoId) { context.res = { status: 400, body: "Todo ID is required." }; return; }
                await collection.updateOne({ nickname: userId }, { $pull: { todos: { _id: new ObjectId(todoId) } } });
                context.res = { status: 200, body: "Todo deleted." };
                break;
            default:
                context.res = { status: 405, body: "Method Not Allowed" };
                break;
        }
    } catch (error) {
        context.log.error(error);
        context.res = { status: 500, body: "An internal server error occurred." };
    }
};
