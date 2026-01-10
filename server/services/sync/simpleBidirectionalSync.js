/**
 * Simple Bidirectional Sync Service
 * 
 * A simplified version to handle Atlas → Local sync for bills
 * This is a temporary fix until the main sync service is working
 */

import mongoose from 'mongoose';
import Logger from '../middleware/logger.js';

class SimpleBidirectionalSync {
    constructor(localConnection, atlasConnection) {
        this.localConnection = localConnection;
        this.atlasConnection = atlasConnection;
        this.changeStream = null;
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) {
            Logger.warn('[SimpleBidirectionalSync] Already running');
            return;
        }

        try {
            Logger.info('[SimpleBidirectionalSync] Starting simple bidirectional sync...');

            // Create change stream for bills collection only
            const pipeline = [
                {
                    $match: {
                        'ns.coll': 'bills'
                    }
                }
            ];

            this.changeStream = this.atlasConnection.db.watch(pipeline, {
                fullDocument: 'updateLookup',
                batchSize: 10
            });

            // Handle changes
            this.changeStream.on('change', async (change) => {
                await this.handleChange(change);
            });

            // Handle errors
            this.changeStream.on('error', (error) => {
                Logger.error('[SimpleBidirectionalSync] Change stream error:', error);
                this.isRunning = false;
            });

            this.isRunning = true;
            Logger.info('[SimpleBidirectionalSync] ✅ Started successfully');

        } catch (error) {
            Logger.error('[SimpleBidirectionalSync] Failed to start:', error);
            throw error;
        }
    }

    async handleChange(change) {
        try {
            const { operationType, ns, documentKey, fullDocument } = change;
            
            Logger.info(`[SimpleBidirectionalSync] Processing ${operationType} on ${ns.coll}`);

            const localCollection = this.localConnection.collection(ns.coll);

            switch (operationType) {
                case 'insert':
                    if (fullDocument) {
                        await localCollection.insertOne(fullDocument);
                        Logger.info(`[SimpleBidirectionalSync] ✅ Inserted: ${documentKey._id}`);
                    }
                    break;

                case 'update':
                    if (fullDocument) {
                        await localCollection.replaceOne(
                            { _id: documentKey._id },
                            fullDocument,
                            { upsert: true }
                        );
                        Logger.info(`[SimpleBidirectionalSync] ✅ Updated: ${documentKey._id}`);
                    }
                    break;

                case 'delete':
                    await localCollection.deleteOne({ _id: documentKey._id });
                    Logger.info(`[SimpleBidirectionalSync] ✅ Deleted: ${documentKey._id}`);
                    break;

                case 'replace':
                    if (fullDocument) {
                        await localCollection.replaceOne(
                            { _id: documentKey._id },
                            fullDocument,
                            { upsert: true }
                        );
                        Logger.info(`[SimpleBidirectionalSync] ✅ Replaced: ${documentKey._id}`);
                    }
                    break;
            }

        } catch (error) {
            Logger.error('[SimpleBidirectionalSync] Error handling change:', error);
        }
    }

    async stop() {
        if (this.changeStream) {
            await this.changeStream.close();
            this.changeStream = null;
        }
        this.isRunning = false;
        Logger.info('[SimpleBidirectionalSync] Stopped');
    }

    isHealthy() {
        return this.isRunning && this.changeStream !== null;
    }
}

export default SimpleBidirectionalSync;
