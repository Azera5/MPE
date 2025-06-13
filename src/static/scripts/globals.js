let MODELS = [];
let META_PROMPTING_MODELS_ONLY = [];

let modelSelections = {};
let selectedStrategies = new Set();

// Load current user from local storage or set default value
let currentUser = localStorage.getItem('currentUser') || 'User';

// Global structure for output boxes content
let outputBoxesContent = {};