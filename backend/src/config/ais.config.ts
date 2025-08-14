export default () => ({
  AIS_HOST: process.env.AIS_HOST ?? 'http://123.24.132.241:8002',
  AIS_DEVICE: process.env.AIS_DEVICE ?? 'ADMIN',
  AIS_ACTION_TYPE: process.env.AIS_ACTION_TYPE ?? 'Offline',
  AIS_USER_ID: Number(process.env.AIS_USER_ID ?? 1),
  AIS_QUERY: process.env.AIS_QUERY ?? '(updatetime >= DateTime(2025, 8, 13, 7, 0, 0))[***]',
  AIS_QUERY_LATEST_BEFORE_STREAM: process.env.AIS_QUERY_LATEST_BEFORE_STREAM ?? 'True',
  AIS_USING_LAST_UPDATE_TIME: (process.env.AIS_USING_LAST_UPDATE_TIME ?? 'false') === 'true',
  AIS_SIGNALR_LOG_LEVEL: (process.env.AIS_SIGNALR_LOG_LEVEL || 'warning').toLowerCase(), // none|critical|error|warning|information|debug|trace
});
