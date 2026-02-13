/**
 * Node.js Middleware for Salesforce → MongoDB sync
 * Handles PromptTemplateVersion insert/update/delete
 */

const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON requests
app.use(bodyParser.json());

// MongoDB connection URI (from env variable)
const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME;

// Helper to connect to MongoDB
async function getMongoClient() {
    // const client = new MongoClient(mongoUri, {
    //     useNewUrlParser: true,
    //     useUnifiedTopology: true
    // });
    const client = new MongoClient(mongoUri);
    await client.connect();
    return client;
}

/**
 * UPSERT endpoint
 */
app.post('/sync_prompt_versions', async (req, res) => {
    const domain = req.query.domain || 'Prompt';
    const payload = req.body;

    if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).send({ error: 'Empty payload' });
    }

    try {
        const client = await getMongoClient();
        const db = client.db(dbName);
        const collection = db.collection(domain);

        const bulkOps = payload.map(doc => ({
            updateOne: {
                filter: { promptVersionId: doc.promptVersionId },
                update: { $set: doc },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            const result = await collection.bulkWrite(bulkOps);
            console.log(`[${domain}] Mongo UPSERT result:`, result.result);
        }

        await client.close();
        res.status(200).send({ message: 'UPSERT completed', domain, count: payload.length });
    } catch (err) {
        console.error('Mongo UPSERT error:', err);
        res.status(500).send({ error: err.message });
    }
});

/**
 * DELETE endpoint
 */
app.post('/delete_prompt_versions', async (req, res) => {
    const domain = req.query.domain || 'Prompt';
    const payload = req.body;

    if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).send({ error: 'Empty payload' });
    }

    try {
        const client = await getMongoClient();
        const db = client.db(dbName);
        const collection = db.collection(domain);

        const idsToDelete = payload.map(p => p.promptVersionId).filter(Boolean);
        if (idsToDelete.length > 0) {
            const result = await collection.deleteMany({ promptVersionId: { $in: idsToDelete } });
            console.log(`[${domain}] Mongo DELETE result:`, result);
        }

        await client.close();
        res.status(200).send({ message: 'DELETE completed', domain, count: idsToDelete.length });
    } catch (err) {
        console.error('Mongo DELETE error:', err);
        res.status(500).send({ error: err.message });
    }
});

/**
 * UPSERT Member Dependencies endpoint
 */
app.post('/sync_member_dependencies', async (req, res) => {
    const payload = req.body;

    // Validate payload
    if (!Array.isArray(payload) || payload.length === 0) {
        return res.status(400).json({ error: 'Payload must be a non-empty array' });
    }

    try {
        const client = await getMongoClient();
        const db = client.db(dbName);
        const collection = db.collection('MemberDependencies');

        // ------------------------------
        // 1️⃣ Collect parent IDs from payload
        // ------------------------------
        const parentIdsFromPayload = payload
            .map(p => p.parentMember?.parentMemberId)
            .filter(Boolean);

        if (parentIdsFromPayload.length === 0) {
            await client.close();
            return res.status(400).json({ error: 'No valid parentMemberId found in payload' });
        }

        // ------------------------------
        // 2️⃣ Prepare bulk UPSERT operations
        // ------------------------------
        const bulkOps = payload.map(doc => {
            const parentId = doc.parentMember?.parentMemberId;
            if (!parentId) return null;

            // Ensure dependentMembers is always an array
            const dependents = Array.isArray(doc.dependentMembers) ? doc.dependentMembers : [];

            // Remove any duplicates in dependentMembers based on memberDependencyId
            const uniqueDependentsMap = new Map();
            dependents.forEach(d => {
                if (d.memberDependencyId) {
                    uniqueDependentsMap.set(d.memberDependencyId, d);
                }
            });
            const uniqueDependents = Array.from(uniqueDependentsMap.values());

            return {
                updateOne: {
                    filter: { parentMemberId: parentId }, // unique key
                    update: {
                        $set: {
                            parentMemberId: parentId,
                            parentMember: doc.parentMember,
                            dependentMembers: uniqueDependents,
                            lastSyncedAt: new Date()
                        }
                    },
                    upsert: true
                }
            };
        }).filter(Boolean); // remove nulls

        if (bulkOps.length > 0) {
            const result = await collection.bulkWrite(bulkOps);
            console.log('Bulk UPSERT result:', result);
        }

        // ------------------------------
        // 3️⃣ DELETE documents NOT present in current payload
        // ------------------------------
        const deleteResult = await collection.deleteMany({
            parentMemberId: { $nin: parentIdsFromPayload }
        });
        console.log('Deleted documents not in payload:', deleteResult.deletedCount);

        await client.close();

        res.status(200).json({
            message: 'Member dependency snapshot sync completed',
            upserted: bulkOps.length,
            deleted: deleteResult.deletedCount
        });

    } catch (error) {
        console.error('Member dependency sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => res.send({ status: 'ok' }));

// Start server
app.listen(port, () => console.log(`Mongo Middleware running on port ${port}`));
