const en = {
  // App
  appName: 'Price Tracker',
  appSubtitle: 'Price Tracker',
  appTagline: 'Record purchases · Compare prices · Save money',
  loading: 'Loading...',

  // Navigation
  navRecords: 'Records',
  navMarket: 'Market',
  navCalculator: 'Calculator',

  // Auth
  signIn: 'Sign in with Google',
  signingIn: 'Signing in…',
  signOut: 'Sign out',
  signInTitle: 'Sign in to get started',
  dataSecure: 'Your data is securely stored and only accessible to you.',
  featureRecord: 'Record item prices from any store',
  featureScan: 'Scan receipts with your camera',
  featureMarket: "Browse today's HK market prices",
  featureSearch: 'Search & compare your purchase history',

  // Records Page
  recordsTitle: 'Shopping Records',
  recordsSaved: '{count} records saved',
  addRecord: 'Add Record',
  searchPlaceholder: 'Search items, categories, or locations...',
  noMatchingRecords: 'No matching records',
  noRecordsYet: 'No records yet',
  tryDifferentSearch: 'Try a different search term',
  tapAddRecord: 'Tap "Add Record" to start tracking prices',
  deleteConfirm: 'Are you sure you want to delete this record?',
  loadError: 'Failed to load records. Please try again.',
  retry: 'Retry',

  // Add/Edit Record Modal
  addPurchaseTitle: 'Add Purchase Record',
  editRecordTitle: 'Edit Record',
  itemName: 'Item Name',
  price: 'Price',
  priceHKD: 'Price (HKD)',
  category: 'Category',
  location: 'Location',
  notes: 'Notes',
  itemNamePlaceholder: 'e.g. Milk',
  notesPlaceholder: 'Optional notes...',
  scanReceipt: 'Scan Receipt / Price Tag',
  saveRecord: 'Save Record',
  saving: 'Saving...',
  update: 'Update',
  cancel: 'Cancel',
  edit: 'Edit',
  delete: 'Delete',

  // Camera
  captureReceipt: '📸 Capture Receipt',
  takePhoto: 'Take Photo',
  uploadImage: 'Upload Image',
  captureHint: 'Take a photo of a receipt or price tag to extract item details',
  retake: 'Retake',
  extractText: 'Extract Text',
  processing: 'Processing...',
  imageProcessError: 'Failed to process image. Please try again or enter details manually.',

  // Market Price Page
  marketTitle: "Today's Market",
  marketSubtitle: 'Hong Kong market prices',
  searchItems: 'Search items...',
  noMatchingPrices: 'No matching prices found',
  vsYesterday: 'vs yesterday',
  noChange: 'No change',
  marketDisclaimer: '💡 Prices shown are estimated averages for Hong Kong markets and supermarkets. Actual prices may vary by location and availability. Data is for reference only.',
  priceHistory: 'Price History (7 days)',
  close: 'Close',

  // Unit Price Calculator
  calcTitle: 'Unit Price Calculator',
  calcSubtitle: 'Compare prices across different units to find the best deal',
  addItem: 'Add Item',
  itemLabel: 'Item {num}',
  productName: 'Product name',
  quantity: 'Quantity',
  unit: 'Unit',
  bestDeal: '🏆 Best Deal!',
  unitPrice: 'Unit price',
  perGram: '/g',
  results: 'Results',
  noItemsYet: 'Add items to compare',
  addItemHint: 'Add at least 2 items with price and quantity to compare unit prices',
  clearAll: 'Clear All',
  remove: 'Remove',
  scanPriceTag: 'Scan Price Tag',

  // Units
  unitGram: 'g',
  unitKilogram: 'kg',
  unitCatty: 'catty (斤)',
  unitTael: 'tael (兩)',
  unitPound: 'lb',
  unitOunce: 'oz',
  unitMillilitre: 'mL',
  unitLitre: 'L',
  unitPiece: 'piece',
  unitPack: 'pack',

  // Settings
  language: 'Language',
  darkMode: 'Dark Mode',
  settings: 'Settings',

  // Categories
  allCategories: 'All',
} as const;

export default en;
export type TranslationKeys = keyof typeof en;
