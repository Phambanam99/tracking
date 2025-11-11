function parseBool(v: any, def = false): boolean {
  if (v == null) return def;
  const s = String(v).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(s);
}

export default () => ({
  AIS_HOST: process.env.AIS_HOST ?? 'http://123.24.132.241:8002',
  AIS_DEVICE: process.env.AIS_DEVICE ?? 'ADMIN',
  AIS_ACTION_TYPE: process.env.AIS_ACTION_TYPE ?? 'Offline',
  AIS_USER_ID: Number(process.env.AIS_USER_ID ?? 3),
  // Static fallback query (only used if dynamic generation disabled)
  AIS_QUERY: process.env.AIS_QUERY ?? '(updatetime >= DateTime(2025, 8, 13, 7, 0, 0))[***]',
  // Minutes lookback for dynamic query window (e.g. 10 => last 10 minutes)
  AIS_QUERY_MINUTES: process.env.AIS_QUERY_MINUTES
    ? parseInt(process.env.AIS_QUERY_MINUTES, 10)
    : 10,
  // If true, after each batch we advance the lower bound to the max updatetime we saw (dedupe / incremental)
  AIS_QUERY_INCREMENTAL: parseBool(process.env.AIS_QUERY_INCREMENTAL, true),
  AIS_QUERY_LATEST_BEFORE_STREAM: process.env.AIS_QUERY_LATEST_BEFORE_STREAM ?? 'True',
  AIS_USING_LAST_UPDATE_TIME: parseBool(process.env.AIS_USING_LAST_UPDATE_TIME, true),
  AIS_AUTO_TRIGGER: parseBool(process.env.AIS_AUTO_TRIGGER, false),
  AIS_AUTO_TRIGGER_INTERVAL_MS: Number(process.env.AIS_AUTO_TRIGGER_INTERVAL_MS ?? 15000),

  // AISStream.io configuration
  AI_STREAM_API: process.env.AI_STREAM_API ?? '89feca5a66015a869401e8911866b85dc6690666',
  AISTREAM_ENABLED: parseBool(process.env.AISTREAM_ENABLED, true),
  AISTREAM_ENDPOINT: process.env.AISTREAM_ENDPOINT ?? 'wss://stream.aisstream.io/v0/stream',
  AISTREAM_POLL_INTERVAL_MS: Number(process.env.AISTREAM_POLL_INTERVAL_MS ?? 30000),
});
