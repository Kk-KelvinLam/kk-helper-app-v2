const zhTW = {
  // App
  appName: '格價助手',
  appSubtitle: '格價助手',
  appTagline: '記錄購物 · 比較價格 · 慳錢助手',
  loading: '載入中...',

  // Navigation
  navRecords: '紀錄',
  navMarket: '行情',
  navCalculator: '計算機',

  // Auth
  signIn: '使用 Google 登入',
  signingIn: '登入中…',
  signOut: '登出',
  signInTitle: '登入以開始使用',
  dataSecure: '你的資料已安全儲存，只有你可以存取。',
  featureRecord: '記錄任何商店的商品價格',
  featureScan: '用相機掃描收據',
  featureMarket: '瀏覽今日香港市場價格',
  featureSearch: '搜尋及比較你的購物記錄',

  // Records Page
  recordsTitle: '購物紀錄',
  recordsSaved: '已儲存 {count} 條紀錄',
  addRecord: '新增紀錄',
  searchPlaceholder: '搜尋物品、類別或地點...',
  noMatchingRecords: '沒有符合的紀錄',
  noRecordsYet: '尚無紀錄',
  tryDifferentSearch: '試試其他搜尋字詞',
  tapAddRecord: '點擊「新增紀錄」開始追蹤價格',
  deleteConfirm: '確定要刪除此紀錄嗎？',
  loadError: '載入紀錄失敗，請重試。',
  retry: '重試',

  // Add/Edit Record Modal
  addPurchaseTitle: '新增購物紀錄',
  editRecordTitle: '編輯紀錄',
  itemName: '物品名稱',
  price: '價格',
  priceHKD: '價格 (HKD)',
  category: '類別',
  location: '地點',
  notes: '備註',
  itemNamePlaceholder: '例如：牛奶',
  notesPlaceholder: '選填備註...',
  scanReceipt: '掃描收據 / 價錢牌',
  saveRecord: '儲存紀錄',
  saving: '儲存中...',
  update: '更新',
  cancel: '取消',
  edit: '編輯',
  delete: '刪除',

  // Camera
  captureReceipt: '📸 拍攝收據',
  takePhoto: '拍照',
  uploadImage: '上傳圖片',
  captureHint: '拍攝收據或價錢牌以提取商品資料',
  retake: '重拍',
  extractText: '提取文字',
  processing: '處理中...',
  imageProcessError: '圖片處理失敗。請重試或手動輸入資料。',

  // Market Price Page
  marketTitle: '今日行情',
  marketSubtitle: '香港市場價格',
  searchItems: '搜尋商品...',
  noMatchingPrices: '找不到符合的價格',
  vsYesterday: '對比昨日',
  noChange: '無變動',
  marketDisclaimer: '💡 所顯示的價格為香港街市及超市的估計平均價格。實際價格可能因地點及供應情況而異。資料僅供參考。',
  priceHistory: '價格走勢 (7日)',
  close: '關閉',

  // Unit Price Calculator
  calcTitle: '單位價格計算機',
  calcSubtitle: '比較不同單位的價格，找出最抵之選',
  addItem: '新增商品',
  itemLabel: '商品 {num}',
  productName: '產品名稱',
  quantity: '數量',
  unit: '單位',
  bestDeal: '🏆 最抵！',
  unitPrice: '單位價格',
  perGram: '/克',
  results: '結果',
  noItemsYet: '新增商品以比較',
  addItemHint: '新增至少 2 個有價格和數量的商品以比較單位價格',
  clearAll: '全部清除',
  remove: '移除',
  scanPriceTag: '掃描價錢牌',

  // Units
  unitGram: '克',
  unitKilogram: '公斤',
  unitCatty: '斤',
  unitTael: '兩',
  unitPound: '磅',
  unitOunce: '安士',
  unitMillilitre: '毫升',
  unitLitre: '公升',
  unitPiece: '件',
  unitPack: '包',

  // Settings
  language: '語言',
  darkMode: '深色模式',
  settings: '設定',

  // Categories
  allCategories: '全部',
} as const;

export default zhTW;
