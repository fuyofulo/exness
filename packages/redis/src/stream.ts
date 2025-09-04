import { getRedis } from "./index";

// Write message to stream
export async function writeToStream(streamName: string, fields: Record<string, string>) {
  const r = await getRedis();
  return await r.xAdd(streamName, '*', fields);
}

// Read messages from stream
export async function readFromStream(streamName: string, groupName: string, consumerName: string, count = 10) {
  const r = await getRedis();
  return await r.xReadGroup(groupName, consumerName, {
    key: streamName,
    id: '>', // Only new messages
  }, { COUNT: count, BLOCK: 5000 });
}

// Acknowledge message processing
export async function ackMessage(streamName: string, groupName: string, messageId: string) {
  const r = await getRedis();
  return await r.xAck(streamName, groupName, messageId);
}

// Create consumer group
export async function createConsumerGroup(streamName: string, groupName: string) {
  const r = await getRedis();
  try {
    await r.xGroupCreate(streamName, groupName, '0', { MKSTREAM: true });
  } catch (err) {
    // Group already exists, ignore
  }
}
