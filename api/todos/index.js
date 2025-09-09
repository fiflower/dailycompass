const { MongoClient, ObjectId } = require('mongodb');

const COSMOS_DB_CONNECTION_STRING = process.env.MONGO_URI;
const DATABASE_NAME = "dbmoodpostbox";
const COLLECTION_NAME = "todolist";

if (!COSMOS_DB_CONNECTION_STRING) {
    throw new Error("Configuration error: MONGO_URI is not set in environment variables.");
}

let client = null;

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

    let userId = getUserInfo(req, context);

    if (!userId && req.headers['host']?.startsWith('localhost')) {
        context.log("--- LOCAL DEV MODE ---");
        const devUserIdHeader = req.headers['x-dev-user-id'];
        if (devUserIdHeader) {
            // [수정] 인코딩된 헤더 값을 원래의 한글 닉네임으로 디코딩합니다.
            try {
                userId = decodeURIComponent(devUserIdHeader);
                context.log(`Using user ID from 'x-dev-user-id' header: '${userId}'`);
            } catch (e) {
                context.log.error("Failed to decode 'x-dev-user-id' header.", e);
                userId = "long"; // 디코딩 실패 시 fallback
            }
        } else {
            userId = "long";
            context.log("No 'x-dev-user-id' header found. Falling back to default test user 'long'.");
        }
    }

    if (!userId) {
        context.res = { status: 401, body: [] };
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

        switch (method) {
            case 'get':
                const userDocument_get = await collection.findOne({ _id: userId });
                context.res = { status: 200, body: userDocument_get ? userDocument_get.todos : [] };
                break;
            case 'post':
                const newTodo = { _id: new ObjectId(), text: req.body.text, date: req.body.date, completed: false };
                await collection.updateOne({ _id: userId }, { $push: { todos: newTodo } }, { upsert: true });
                context.res = { status: 201, body: newTodo };
                break;
            case 'put':
                if (!todoId) { context.res = { status: 400, body: "Todo ID is required." }; return; }
                await collection.updateOne({ _id: userId, "todos._id": new ObjectId(todoId) }, { $set: { "todos.$.completed": req.body.completed } });
                context.res = { status: 200, body: "Todo updated." };
                break;
            case 'delete':
                if (!todoId) { context.res = { status: 400, body: "Todo ID is required." }; return; }
                await collection.updateOne({ _id: userId }, { $pull: { todos: { _id: new ObjectId(todoId) } } });
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

