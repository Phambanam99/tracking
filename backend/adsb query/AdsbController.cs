using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Newtonsoft.Json.Linq;
using Osint.ADSB.Entity;
using Osint.Utils;
using StackExchange.Redis;
using System.Text;
using System.Text.Json;

namespace Osint.WebApi
{
    [Route("api/[controller]")]
    [ApiController]
    public partial class OsintController : ControllerBase
    {
        private readonly ApplicationContext _dbContext;
        private readonly ILogger _logger;
        private readonly AppConfiguration _appConfiguration;
        private readonly int _redisDb = 0;
        private readonly IDatabase _redisDatabase;
        private readonly IServer _redisServer;
        private readonly TimeSpan _redisExpiry;

        public OsintController(
            ApplicationContext dbContext,
            ILogger logger,
            IOptions<AppConfiguration> appConfiguration,
            IConnectionMultiplexer redis
        )
        {
            _dbContext = dbContext;
            _logger = logger;
            _appConfiguration = appConfiguration.Value;
            if (_appConfiguration.UsingRedis.HasValue && _appConfiguration.UsingRedis.Value)
            {
                _redisDatabase = redis.GetDatabase(this._redisDb);
                _redisServer = redis.GetServer(_appConfiguration.Redis.Host, _appConfiguration.Redis.Port);
                _redisExpiry = TimeSpan.FromMinutes(_appConfiguration.Redis.TimeSpan ?? 5);
            }
        }

        #region Deplicate Controllers
        //[HttpPost]
        //[Route("adsb/stream")]
        //public async Task StreamAdsbData([FromBody] JObject model, CancellationToken cancellationToken)
        //{
        //    string query = model.Value<string>("FieldFilter");
        //    string position = model.Value<string>("PositionFilter");
        //    Response.ContentType = "application/json";
        //    //var server = _redis.GetServer(_appConfiguration.Redis.Host, _appConfiguration.Redis.Port); 
        //    //var db = _redis.GetDatabase(this.redisDb);

        //    while (!cancellationToken.IsCancellationRequested)
        //    {
        //        try
        //        {
        //            var keys = _redisServer.Keys(this._redisDb);
        //            var result = new List<AdsbModel>();
        //            ConcurrentBag<AdsbModel> processedNumbers = new ConcurrentBag<AdsbModel>();
        //            await Parallel.ForEachAsync(keys, async (key, cancellationToken) =>
        //            {
        //                var value = await _redisDatabase.StringGetAsync(key);
        //                processedNumbers.Add(Newtonsoft.Json.JsonConvert.DeserializeObject<AdsbModel>(value));
        //            });
        //            int limit = _appConfiguration.Adsb.LimitQuery ?? 1000;
        //            int start = 0;
        //            int count = processedNumbers.Count;

        //            while (!cancellationToken.IsCancellationRequested && start < count)
        //            {
        //                try
        //                {
        //                    IEnumerable<AdsbModel>? batchValues = null;
        //                    if (!string.IsNullOrEmpty(query))
        //                    {
        //                        batchValues = processedNumbers.AsQueryable().Where2(query).OrderBy("UnixTime asc").Skip(start).Take(limit).Cast<AdsbModel>();
        //                    }
        //                    else
        //                    {
        //                        batchValues = processedNumbers.OrderBy(x => x.UnixTime).Skip(start).Take(limit);
        //                    }

        //                    await JsonSerializer.SerializeAsync(Response.Body, batchValues, cancellationToken: cancellationToken);
        //                    await Response.WriteAsync("\n");// Ensure the client knows the end of the line
        //                    await Response.Body.FlushAsync();// Ensure the response is sent immediately
        //                }
        //                catch (Exception ex1)
        //                {
        //                    _logger.LogError($"{nameof(StreamAdsbData)} Error: {ex1.Message}");
        //                }
        //                start += limit;
        //            }
        //            GC.Collect();
        //            GC.WaitForPendingFinalizers();
        //            await Task.Delay((_appConfiguration.StreamSleep ?? 120) * 1000);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError($"{nameof(StreamAdsbData)}1 Error: {ex.Message}");
        //        }
        //    }
        //}

        //public async Task<IActionResult> FetchAdsbData([FromBody] JObject model, CancellationToken cancellationToken)
        //{
        //    var data = model.Value<JArray>("data");
        //    if (data == null) return new EmptyResult();
        //    List<AdsbModel>? adsbModels = data.ToObject<List<AdsbModel>>();
        //    if (adsbModels == null) return new EmptyResult();

        //    if (_appConfiguration.UsingRedis.HasValue && _appConfiguration.UsingRedis.Value)
        //    {
        //        await Parallel.ForEachAsync<AdsbModel>(adsbModels, async (item, cancellationToken) =>
        //        {
        //            try
        //            {
        //                // Hexident as key
        //                if (!string.IsNullOrEmpty(item.Hexident))
        //                {
        //                    item.Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        //                    var value = Newtonsoft.Json.JsonConvert.SerializeObject(item);
        //                    await _redisDatabase.StringSetAsync($"{item.Hexident}", value);
        //                }
        //            }
        //            catch (Exception ex)
        //            {
        //                _logger.LogError(ex.Message);
        //            }
        //        });
        //    }

        //    try
        //    {
        //        await _dbContext.BulkInsert(adsbModels, cancellationToken);
        //    }
        //    catch (Exception ex)
        //    {
        //        _logger.LogError(ex.Message);
        //    }
        //    adsbModels?.Clear();
        //    return Ok();
        //}
        #endregion

        [HttpPost]
        [Route("adsb/stream")]
        public async Task StreamAdsbData([FromBody] JObject model, CancellationToken cancellationToken)
        {
            string query = model.Value<string>("FieldFilter");
            string position = model.Value<string>("PositionFilter");
            Response.ContentType = "application/json";

            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var hashEntries = await _redisDatabase.HashGetAllAsync("adsb:current_flights");

                    if (hashEntries.Length == 0)
                    {
                        await Task.Delay(1000, cancellationToken); // Chờ nếu không có dữ liệu
                        continue;
                    }

                    var allPlanes = hashEntries.Select(entry => Newtonsoft.Json.JsonConvert.DeserializeObject<AdsbModel>(entry.Value)).ToList();
                    _logger.LogInformation($"Loaded {allPlanes.Count} records from Redis Hash.");
                    // Áp dụng bộ lọc động một cách an toàn trên danh sách trong bộ nhớ
                    IEnumerable<AdsbModel> filteredPlanes = allPlanes;
                    if (!string.IsNullOrWhiteSpace(query))
                    {
                        filteredPlanes = filteredPlanes.AsQueryable().Where(query);
                    }
                    var planesToSend = filteredPlanes.OrderBy(p => p.UnixTime).ToList();
                    int totalCount = planesToSend.Count;
                    int start = 0;
                    int limit = _appConfiguration.Adsb.LimitQuery ?? 1000;

                    while (start < totalCount && !cancellationToken.IsCancellationRequested)
                    {
                        var batch = planesToSend.Skip(start).Take(limit);

                        await JsonSerializer.SerializeAsync(Response.Body, batch, cancellationToken: cancellationToken);
                        await Response.WriteAsync("\n");
                        await Response.Body.FlushAsync();

                        start += limit;
                    }

                    await Task.Delay((_appConfiguration.StreamSleep ?? 120) * 1000, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break; // Client đã ngắt kết nối
                }
                catch (Exception ex)
                {
                    _logger.LogError($"{nameof(StreamAdsbData)} Error: {ex.Message}");
                }
            }
        }

        [HttpPost]
        [Route("adsb/fetch")]
        public async Task<IActionResult> FetchAdsbData([FromBody] List<AdsbModel> adsbModels, CancellationToken cancellationToken)
        {
            if (adsbModels == null || !adsbModels.Any())
            {
                return BadRequest("Dữ liệu rỗng.");
            }

            if (_appConfiguration.UsingRedis.HasValue && _appConfiguration.UsingRedis.Value)
            {
                // Chuyển đổi list thành mảng HashEntry để ghi một lần
                var hashEntries = adsbModels
                    .Where(item => !string.IsNullOrEmpty(item.Hexident))
                    .Select(item => new HashEntry(
                        item.Hexident,
                        Newtonsoft.Json.JsonConvert.SerializeObject(item))
                    ).ToArray();

                if (hashEntries.Any())
                {
                    // Ghi toàn bộ mảng vào hash "adsb:current_flights" trong một lệnh duy nhất
                    await _redisDatabase.HashSetAsync("adsb:current_flights", hashEntries);
                }

                // Đặt thời gian hết hạn cho toàn bộ Hash
                await _redisDatabase.KeyExpireAsync("adsb:current_flights", _redisExpiry);
            }

            try
            {
                await _dbContext.BulkInsert(adsbModels, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.Message);
            }

            adsbModels?.Clear();

            return Ok();
        }

        [HttpPost("adsb/query")]
        public async Task QueryDataAsync([FromBody] JObject model, CancellationToken cancellationToken)
        {
            Response.ContentType = "application/json";
            int start = 0;
            int limit = _appConfiguration.Adsb.LimitQuery.HasValue ? _appConfiguration.Adsb.LimitQuery.Value : 500;
            string query = model.Value<string>("FieldFilter");
            string position = model.Value<string>("PositionFilter");
            string countQuery = CreateAdsbCountQuery(query, position);
            int count = await _dbContext.GetCountAsync(countQuery);
            _logger.LogWarning(countQuery);
            _logger.LogWarning($"Total count: {count}");
            _logger.LogWarning(CreateAdsbSelectQuery(query, position, start, limit));

            while (count > start && !cancellationToken.IsCancellationRequested)
            {
                var selectQuery = CreateAdsbSelectQuery(query, position, start, limit);
                var result = await _dbContext.QueryAsync(selectQuery);
                start += limit;
                await JsonSerializer.SerializeAsync(Response.Body, result, cancellationToken: cancellationToken);
                await Response.WriteAsync("\n");// Ensure the client knows the end of the line
                await Response.Body.FlushAsync();// Ensure the response is sent immediately      
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="fieldQuery"></param>
        /// <param name="positionQuery">
        /// [Position] = 'Polygon((108.621826171875 17.800996047667, 110.797119140625 18.3649526265392, 113.0712890625 17.6754278183394, 113.0712890625 16.0352548623504, 110.41259765625 15.4960324142386, 108.621826171875 17.800996047667))' Or [Position] = 'Polygon((111.24755859375 14.0513307435182, 114.093017578125 14.3282596777428, 114.3896484375 12.565286943988, 111.412353515625 11.7275455903404, 111.24755859375 14.0513307435182))'
        /// </param>
        /// <returns></returns>
        private string CreateAdsbCountQuery(string fieldQuery, string positionQuery)
        {
            string baseQuery = "select count(*) INTO temp_count from adsb";
            if (string.IsNullOrEmpty(fieldQuery) && string.IsNullOrEmpty(positionQuery))
            {
                baseQuery = $"{baseQuery};\r\n:v_count := temp_count";
                return $"{baseQuery.ToUpper()};";
            }

            StringBuilder query = new StringBuilder();
            fieldQuery = fieldQuery.Replace("'", "''");
            if (!string.IsNullOrEmpty(positionQuery))
            {
                (string withPolygons, string wherePolygons) = this.CreatePolygonSqlQuery(positionQuery);
                query.AppendLine($"with");
                query.AppendLine(withPolygons);
                // with ... select count(*) from adsb
                query.AppendLine($"{baseQuery}");
                query.AppendLine("where");
                // query = with ... select count(*) from adsb where
                if (!string.IsNullOrEmpty(fieldQuery))
                {
                    query.AppendLine($"{fieldQuery} and ");
                }
                query.AppendLine($"{wherePolygons};");
            }
            else
            {
                query.AppendLine($"{baseQuery}");
                query.AppendLine($"where {fieldQuery};");
            }
            query.AppendLine(":v_count := temp_count;");
            return $"{query.ToString()}";
        }
        private string CreateAdsbSelectQuery(string fieldQuery, string positionQuery, int start = 0, int limit = 1000)
        {
            string baseQuery = "SELECT ID,SQUAWK,UPDATETIME,HEXIDENT,RECEVERSOURCEID,LONGITUDE,CONTRUCTORNUMBER,SPEED,SECSOFTRACK,COUNTRY,BEARING,AIRCRAFTID,TYPE,REGISTER,SPEEDTYPE,DISTANCE,TARGETALT,ENGINES,ISTISB,MANUFACTURE,FROMPORT,TOPORT,ALTITUDE,UNIXTIME,ENGINETYPE,ALTITUDETYPE,CALLSIGN,OPERATOR,TRANSPONDERTYPE,SOURCE,OPERATORCODE,LATITUDE,VERTICALSPEED FROM ADSB";
            if (!string.IsNullOrEmpty(_appConfiguration.Adsb.SelectField))
            {
                baseQuery = $"SELECT {_appConfiguration.Adsb.SelectField} FROM ADSB";
            }
            if (string.IsNullOrEmpty(fieldQuery) && string.IsNullOrEmpty(positionQuery))
            {
                baseQuery += $"\r\nORDER BY UNIXTIME";
                baseQuery += $"\r\nOFFSET {start} ROWS FETCH NEXT {limit} ROWS ONLY";
                return $"{baseQuery.ToUpper()}";
            }

            StringBuilder query = new StringBuilder();

            if (!string.IsNullOrEmpty(positionQuery))
            {
                (string withPolygons, string wherePolygons) = this.CreatePolygonSqlQuery(positionQuery, true);
                query.AppendLine($"with");
                query.AppendLine(withPolygons);
                // with ... select count(*) from adsb
                query.AppendLine($"{baseQuery}");
                query.AppendLine("where");
                // query = with ... select count(*) from adsb where
                if (!string.IsNullOrEmpty(fieldQuery))
                {
                    query.AppendLine($"{fieldQuery} and ");
                }
                query.AppendLine($"{wherePolygons}");
            }
            else
            {
                query.AppendLine($"{baseQuery}");
                query.AppendLine($"where {fieldQuery}");
            }
            /*Order by*/
            query.AppendLine($"ORDER BY UNIXTIME");
            query.AppendLine($"OFFSET {start} ROWS FETCH NEXT {limit} ROWS ONLY");
            return $"{query.ToString()}";
        }
        private Tuple<string, string> CreatePolygonSqlQuery(string positionQuery, bool oneQuotation = false)
        {
            positionQuery = positionQuery.ToLower()
                                    .Replace("[position] = ", string.Empty)
                                    .Replace("polygon", string.Empty)
                                    .Replace("'", string.Empty)
                                    .Replace(", ", ",")
                                    .Replace(" ", ",")
                                    .Replace("((", string.Empty)
                                    .Replace("))", string.Empty);
            int findIndex = 0;
            List<string> operators = new List<string>();
            while (findIndex != -1)
            {
                var findIndexOr = positionQuery.IndexOf("or", findIndex);
                var findIndexAnd = positionQuery.IndexOf("and", findIndex);
                if (findIndexOr == -1 && findIndexAnd == -1)
                {
                    break;
                }
                if (findIndexAnd > findIndexOr)
                {
                    if (findIndexOr != -1)
                    {
                        operators.Add("or");
                        findIndex = findIndexOr + 2;
                    }
                    else
                    {
                        operators.Add("and");
                        findIndex = findIndexAnd + 3;
                    }
                }
                else
                {
                    if (findIndexAnd != -1)
                    {
                        operators.Add("and");
                        findIndex = findIndexAnd + 3;
                    }
                    else
                    {
                        operators.Add("or");
                        findIndex = findIndexOr + 2;
                    }
                }
            };
            positionQuery = positionQuery.Replace("or", "###").Replace("and", "###");
            string[] splitPositions = positionQuery.Split(",###,", StringSplitOptions.RemoveEmptyEntries);
            var withPolygons = new List<string>();
            var wherePolygons = new List<string>();
            int i = 0;
            foreach (var position in splitPositions)
            {
                string polygon = $@"
polygon{i} AS ( 
    SELECT SDO_GEOMETRY(2003, 8307, NULL, SDO_ELEM_INFO_ARRAY(1, 1003, 1), SDO_ORDINATE_ARRAY({position})) AS geom FROM dual)";
                withPolygons.Add(polygon);
                if (oneQuotation)
                {
                    wherePolygons.Add($@"SDO_INSIDE(PT, (SELECT geom FROM polygon{i}) ) = 'TRUE' {(i < operators.Count ? operators[i] + " " : "")}
");
                }
                else
                {
                    wherePolygons.Add($@"SDO_INSIDE(PT, (SELECT geom FROM polygon{i}) ) = ''TRUE'' {(i < operators.Count ? operators[i] + " " : "")}
");
                }
                i++;
            }

            return new Tuple<string, string>(string.Join(",", withPolygons), $@"(
    {string.Join("", wherePolygons)}
)");
        }
        private async ValueTask FetchAdsbDataAsync(IList<AdsbModel> adsbModels, CancellationToken cancellationToken)
        {
            try
            {
                await _dbContext.BulkInsert(adsbModels, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex.Message);
            }
            adsbModels.Clear();
        }
        private async ValueTask CacheValue(IList<AdsbModel> adsbModels)
        {
            // var db = _redis.GetDatabase(this.redisDb);
            await Parallel.ForEachAsync<AdsbModel>(adsbModels, async (item, cancellationToken) =>
            {
                try
                {
                    // Hexident as key
                    if (!string.IsNullOrEmpty(item.Hexident))
                    {
                        item.Id = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                        var value = Newtonsoft.Json.JsonConvert.SerializeObject(item);
                        await _redisDatabase.StringSetAsync($"{item.Hexident}", value, _redisExpiry);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex.Message);
                }
            });
            //_logger.LogWarning($"End update cache: {adsbModels.Count} values");
            adsbModels.Clear();
        }
    }
}
