import http from 'http';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: 'localhost', port: 8000, path, method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) } },
      res => {
        let d = ''; res.setEncoding('utf8');
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }
    );
    req.on('error', reject);
    req.write(data); req.end();
  });
}

let passed = 0, failed = 0, warned = 0;

function result(label, ok, info = '') {
  if (ok === true)  { passed++; console.log(`  ✅ PASS  ${label}${info ? ' — ' + info : ''}`); }
  else if (ok === false) { failed++; console.log(`  ❌ FAIL  ${label}${info ? ' — ' + info : ''}`); }
  else               { warned++;  console.log(`  ⚠️  WARN  ${label}${info ? ' — ' + info : ''}`); }
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       AI SERVICE — FULL TEST SUITE               ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ══════════════════════════════════
  //  RAG CHATBOT
  // ══════════════════════════════════
  console.log('── RAG Chatbot (12 test cases) ──\n');

  let r;

  // TC-RAG-01: Hỏi giá xe 4 chỗ — phải trả đúng giá mới (24.000đ + 15.000đ/km)
  console.log('TC-RAG-01: Hỏi giá cước xe 4 chỗ');
  r = await post('/api/chat', { message: 'Giá xe 4 chỗ bao nhiêu tiền một km?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 180).replace(/\n/g, ' '));
  result('Có đề cập 15.000đ/km', r.answer?.includes('15.000'), `score=${r.score_max}`);
  result('Source đúng', r.sources?.includes('Bảng giá và cách tính cước'));

  // TC-RAG-02: Hỏi giá xe máy
  console.log('\nTC-RAG-02: Hỏi giá cước xe máy');
  r = await post('/api/chat', { message: 'Đi xe máy giá bao nhiêu?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 150).replace(/\n/g, ' '));
  result('Có đề cập 6.200đ/km', r.answer?.includes('6.200'));

  // TC-RAG-03: Hỏi về phí chuyến ngắn
  console.log('\nTC-RAG-03: Phí chuyến ngắn dưới 2.5km');
  r = await post('/api/chat', { message: 'Đi chuyến ngắn dưới 2km có bị phụ phí không?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Đề cập phí chuyến ngắn', r.answer?.includes('2,5') || r.answer?.includes('ngắn'));

  // TC-RAG-04: Hỏi về surge giờ cao điểm
  console.log('\nTC-RAG-04: Giá surge giờ cao điểm');
  r = await post('/api/chat', { message: 'Tại sao giờ cao điểm giá lại cao hơn?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Đề cập surge/hệ số', r.answer?.includes('surge') || r.answer?.includes('hệ số'));

  // TC-RAG-05: Hỏi về voucher
  console.log('\nTC-RAG-05: Hỏi về voucher giảm giá');
  r = await post('/api/chat', { message: 'Tôi dùng voucher WELCOME20 được giảm bao nhiêu?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Tìm thấy thông tin voucher', r.score_max > 0.4, `score=${r.score_max}`);

  // TC-RAG-06: Hỏi hủy chuyến
  console.log('\nTC-RAG-06: Chính sách hủy chuyến');
  r = await post('/api/chat', { message: 'Hủy chuyến sau khi tài xế nhận thì có bị phạt không?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Đề cập chính sách hủy', r.answer?.includes('hủy') || r.answer?.includes('phí'));

  // TC-RAG-07: Phương thức thanh toán
  console.log('\nTC-RAG-07: Phương thức thanh toán');
  r = await post('/api/chat', { message: 'Có thể thanh toán bằng MoMo không?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Đề cập MoMo/thanh toán online', r.answer?.toLowerCase().includes('momo') || r.answer?.includes('ví điện tử'));

  // TC-RAG-08: Đăng ký tài xế
  console.log('\nTC-RAG-08: Đăng ký tài xế');
  r = await post('/api/chat', { message: 'Muốn đăng ký làm tài xế cần giấy tờ gì?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Đề cập giấy tờ/đăng ký', r.score_max > 0.4, `score=${r.score_max}`);

  // TC-RAG-09: An toàn / hỗ trợ khẩn cấp
  console.log('\nTC-RAG-09: An toàn hành khách');
  r = await post('/api/chat', { message: 'Trong chuyến đi có vấn đề an toàn thì làm gì?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Tìm thấy thông tin an toàn', r.score_max > 0.3, `score=${r.score_max}`);

  // TC-RAG-10: Ví & nạp tiền
  console.log('\nTC-RAG-10: Ví tài xế và nạp tiền');
  r = await post('/api/chat', { message: 'Tài xế nạp tiền vào ví như thế nào?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Đề cập ví/nạp tiền', r.answer?.includes('ví') || r.answer?.includes('nạp'));

  // TC-RAG-11: Multi-turn conversation
  console.log('\nTC-RAG-11: Multi-turn (nhớ context)');
  const history = [
    { role: 'user', content: 'Xe tay ga giá bao nhiêu?' },
    { role: 'assistant', content: 'Xe tay ga khởi điểm 14.000đ, cước 8.400đ/km.' }
  ];
  r = await post('/api/chat', { message: 'Còn xe 7 chỗ?', history, top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 200).replace(/\n/g, ' '));
  result('Multi-turn hoạt động', r.answer?.length > 10);

  // TC-RAG-12: Câu hỏi ngoài phạm vi
  console.log('\nTC-RAG-12: Câu hỏi ngoài phạm vi (thời tiết)');
  r = await post('/api/chat', { message: 'Thời tiết hôm nay có đẹp không?', history: [], top_k: 4 });
  console.log('  Answer:', r.answer?.substring(0, 150).replace(/\n/g, ' '));
  result('Fallback khi không tìm thấy', r.score_max < 0.5 || r.answer?.includes('không') || r.answer?.includes('liên hệ'),
    `score=${r.score_max}`);

  // ══════════════════════════════════
  //  ML MODEL 1: ETA + Price Multiplier
  // ══════════════════════════════════
  console.log('\n── ML Model: ETA & Price Multiplier (5 test cases) ──\n');

  // TC-ML-01: Rush hour → ETA cao hơn + surge cao hơn off-peak
  console.log('TC-ML-01: Rush-hour vs off-peak cùng distance');
  const peak = await post('/api/predict', { distance_km: 5, time_of_day: 'RUSH_HOUR', day_type: 'WEEKDAY' });
  const offpeak = await post('/api/predict', { distance_km: 5, time_of_day: 'OFF_PEAK', day_type: 'WEEKDAY' });
  console.log(`  Rush-hour  → ETA: ${peak.eta_minutes}min, surge: ${peak.price_multiplier}`);
  console.log(`  Off-peak   → ETA: ${offpeak.eta_minutes}min, surge: ${offpeak.price_multiplier}`);
  result('Rush-hour ETA >= Off-peak', peak.eta_minutes >= offpeak.eta_minutes);
  result('Rush-hour surge >= Off-peak', peak.price_multiplier >= offpeak.price_multiplier);

  // TC-ML-02: Distance tăng → ETA tăng
  console.log('\nTC-ML-02: Distance tăng → ETA tăng');
  const short = await post('/api/predict', { distance_km: 2, time_of_day: 'OFF_PEAK', day_type: 'WEEKDAY' });
  const longd  = await post('/api/predict', { distance_km: 20, time_of_day: 'OFF_PEAK', day_type: 'WEEKDAY' });
  console.log(`  2km  → ETA: ${short.eta_minutes}min`);
  console.log(`  20km → ETA: ${longd.eta_minutes}min`);
  result('ETA 20km > ETA 2km', longd.eta_minutes > short.eta_minutes);

  // TC-ML-03: Weekend discount (surge thấp hơn weekday off-peak)
  console.log('\nTC-ML-03: Surge weekend vs weekday');
  const weekday = await post('/api/predict', { distance_km: 5, time_of_day: 'OFF_PEAK', day_type: 'WEEKDAY' });
  const weekend = await post('/api/predict', { distance_km: 5, time_of_day: 'OFF_PEAK', day_type: 'WEEKEND' });
  console.log(`  Weekday off-peak → surge: ${weekday.price_multiplier}`);
  console.log(`  Weekend off-peak → surge: ${weekend.price_multiplier}`);
  result('Weekend surge <= Weekday', weekend.price_multiplier <= weekday.price_multiplier);

  // TC-ML-04: Output trong range hợp lệ
  console.log('\nTC-ML-04: Output trong range hợp lệ');
  r = await post('/api/predict', { distance_km: 8.2, time_of_day: 'RUSH_HOUR', day_type: 'WEEKDAY' });
  console.log(`  ETA: ${r.eta_minutes}min, surge: ${r.price_multiplier}, demand: ${r.insights?.demand_level}`);
  result('ETA trong [1, 120]', r.eta_minutes >= 1 && r.eta_minutes <= 120, `eta=${r.eta_minutes}`);
  result('Surge trong [1.0, 2.0]', r.price_multiplier >= 1.0 && r.price_multiplier <= 2.0, `surge=${r.price_multiplier}`);

  // TC-ML-05: Model version & insights có trong response
  console.log('\nTC-ML-05: Response có đầy đủ fields');
  result('Có model_version', !!r.model_version, r.model_version);
  result('Có insights.demand_level', !!r.insights?.demand_level);
  result('Có insights.eta_confidence', !!r.insights?.eta_confidence);

  // ══════════════════════════════════
  //  ML MODEL 2: Accept Probability
  // ══════════════════════════════════
  console.log('\n── ML Model: Driver Accept Probability (4 test cases) ──\n');

  // Batch helper: so sánh good vs bad driver trong cùng 1 call
  async function batchAccept(context, drivers) {
    return post('/api/predict/accept/batch', { context, drivers });
  }

  // TC-ACC-01: Tài xế tốt vs tài xế xấu trong batch
  console.log('TC-ACC-01: Batch — Tài xế tốt vs tài xế xấu');
  let batch = await batchAccept(
    { distance_km: 3, fare_estimate: 64000, surge_multiplier: 1.2,
      hour_of_day: 8, pickup_zone: 'A', demand_level: 'HIGH', available_driver_count: 5 },
    [
      { driver_id: 'good', eta_minutes: 3,  driver_accept_rate: 0.92, driver_cancel_rate: 0.03 },
      { driver_id: 'bad',  eta_minutes: 25, driver_accept_rate: 0.35, driver_cancel_rate: 0.45 }
    ]
  );
  const goodProb = batch.results.find(r => r.driver_id === 'good')?.p_accept;
  const badProb  = batch.results.find(r => r.driver_id === 'bad')?.p_accept;
  console.log(`  Good driver p_accept: ${goodProb?.toFixed(3)}, Bad driver: ${badProb?.toFixed(3)}`);
  result('Tài xế tốt → prob > 0.6',  goodProb > 0.6);
  result('Tài xế xấu → prob < good', badProb < goodProb);

  // TC-ACC-02: Fare cao → prob cao hơn fare thấp (cùng driver)
  console.log('\nTC-ACC-02: Fare cao vs thấp (cùng driver)');
  const highFareBatch = await batchAccept(
    { distance_km: 8, fare_estimate: 257000, surge_multiplier: 1.0,
      hour_of_day: 12, pickup_zone: 'B', demand_level: 'MEDIUM', available_driver_count: 8 },
    [{ driver_id: 'drv', eta_minutes: 10, driver_accept_rate: 0.75, driver_cancel_rate: 0.1 }]
  );
  const lowFareBatch = await batchAccept(
    { distance_km: 8, fare_estimate: 18000, surge_multiplier: 1.0,
      hour_of_day: 12, pickup_zone: 'B', demand_level: 'MEDIUM', available_driver_count: 8 },
    [{ driver_id: 'drv', eta_minutes: 10, driver_accept_rate: 0.75, driver_cancel_rate: 0.1 }]
  );
  const pHigh = highFareBatch.results[0]?.p_accept;
  const pLow  = lowFareBatch.results[0]?.p_accept;
  console.log(`  Fare 257k → p: ${pHigh?.toFixed(3)}, Fare 18k → p: ${pLow?.toFixed(3)}`);
  result('Fare cao → prob cao hơn', pHigh >= pLow);

  // TC-ACC-03: Response đầy đủ fields
  console.log('\nTC-ACC-03: Batch response có đủ fields');
  result('Có model_version', !!batch.model_version, batch.model_version);
  result('reason_code = AI_OK', batch.reason_code === 'AI_OK');

  // TC-ACC-04: Confidence hợp lệ
  console.log('\nTC-ACC-04: Confidence trong range [0,1]');
  const goodConf = batch.results.find(r => r.driver_id === 'good')?.confidence;
  result('Confidence trong [0,1]', goodConf >= 0 && goodConf <= 1, `conf=${goodConf?.toFixed(3)}`);

  // ══════════════════════════════════
  //  ML MODEL 3: Wait Time
  // ══════════════════════════════════
  console.log('\n── ML Model: Wait Time Prediction (4 test cases) ──\n');

  // TC-WAIT-01: Demand cao, ít tài xế, giờ peak → wait dài
  console.log('TC-WAIT-01: Demand cao + ít tài xế + giờ peak');
  const peakWait = await post('/api/predict/wait-time', {
    demand_level: 'HIGH', active_booking_count: 50, available_driver_count: 2,
    hour_of_day: 8, day_of_week: 1, surge_multiplier: 1.5,
    avg_accept_rate: 0.55, historical_wait_p50: 8, pickup_zone: 'A'
  });
  console.log(`  Wait time: ${peakWait.wait_time_minutes}min, confidence: ${peakWait.confidence}`);
  result('Wait trong [1,15]', peakWait.wait_time_minutes >= 1 && peakWait.wait_time_minutes <= 15);

  // TC-WAIT-02: Demand thấp, nhiều tài xế, off-peak → wait ngắn
  console.log('\nTC-WAIT-02: Demand thấp + nhiều tài xế + off-peak');
  const offWait = await post('/api/predict/wait-time', {
    demand_level: 'LOW', active_booking_count: 3, available_driver_count: 25,
    hour_of_day: 14, day_of_week: 3, surge_multiplier: 1.0,
    avg_accept_rate: 0.9, historical_wait_p50: 2.5, pickup_zone: 'B'
  });
  console.log(`  Wait time: ${offWait.wait_time_minutes}min`);
  result('Peak wait > Off-peak wait', peakWait.wait_time_minutes > offWait.wait_time_minutes,
    `${peakWait.wait_time_minutes} > ${offWait.wait_time_minutes}`);

  // TC-WAIT-03: Surge cao → tài xế chạy nhiều → wait giảm
  console.log('\nTC-WAIT-03: Surge 1.5 vs 1.0 cùng demand HIGH');
  const surgeWait = await post('/api/predict/wait-time', {
    demand_level: 'HIGH', active_booking_count: 30, available_driver_count: 5,
    hour_of_day: 17, day_of_week: 2, surge_multiplier: 1.8,
    avg_accept_rate: 0.8, historical_wait_p50: 5, pickup_zone: 'A'
  });
  const noSurgeWait = await post('/api/predict/wait-time', {
    demand_level: 'HIGH', active_booking_count: 30, available_driver_count: 5,
    hour_of_day: 17, day_of_week: 2, surge_multiplier: 1.0,
    avg_accept_rate: 0.8, historical_wait_p50: 5, pickup_zone: 'A'
  });
  console.log(`  Surge 1.8 → wait: ${surgeWait.wait_time_minutes}min`);
  console.log(`  Surge 1.0 → wait: ${noSurgeWait.wait_time_minutes}min`);
  result('Surge cao → wait <= no-surge', surgeWait.wait_time_minutes <= noSurgeWait.wait_time_minutes);

  // TC-WAIT-04: Model version
  console.log('\nTC-WAIT-04: Response có model_version & confidence');
  result('Có model_version', !!peakWait.model_version, peakWait.model_version);
  result('Confidence trong [0,1]', peakWait.confidence >= 0 && peakWait.confidence <= 1);

  // ══ Summary ══
  const total = passed + failed + warned;
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passed}/${total} PASS  |  ${failed} FAIL  |  ${warned} WARN          ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');
}

runTests().catch(e => console.error('Error:', e.message));
